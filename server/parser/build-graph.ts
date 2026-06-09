import type {
  RawWorkflow, WorkflowGraph, WorkflowNode, WorkflowEdge,
  UnresolvedLink, SkippedWorkflow, ScheduleEntry,
} from '#shared/types/graph'
import type { NodeCatalog } from '../catalog/catalog'
import { prettifyType } from '#shared/prettify'
import { stripTrailingSlash } from '#shared/url'
import { classifyTriggers, extractTriggerNodes } from './triggers'
import { extractExecuteLinks, extractErrorLink, extractWebhookHttpLinks } from './links'
import { summarize, extractTags, extractWebhookPaths } from './summarize'
import { buildWebhooks } from '../webhooks/build'
import { parseSchedule } from '../schedule/parse'
import { nextFire } from '../schedule/next-fire'
import { extractCredentials } from './credentials'
import { extractDataTables } from './data-tables'
import { mergeCredentials, mergeDataTables } from './merge'
import type { ApiCredential, ApiDataTable } from '../ingest/n8n-client'

export function buildGraph(
  workflows: RawWorkflow[],
  baseUrl: string | null,
  opts: { from?: string; catalog?: NodeCatalog; apiCredentials?: ApiCredential[] | null; apiDataTables?: ApiDataTable[] | null } = {},
): WorkflowGraph {
  const catalog: NodeCatalog = opts.catalog ?? { displayName: prettifyType }
  const from = opts.from ?? null

  const valid: RawWorkflow[] = []
  const skipped: SkippedWorkflow[] = []
  for (const wf of workflows ?? []) {
    if (!wf || typeof wf.id !== 'string' || !Array.isArray(wf.nodes)) {
      skipped.push({ name: wf?.name, reason: 'missing id or nodes' })
      continue
    }
    valid.push(wf)
  }

  const edges: WorkflowEdge[] = []
  const unresolved: UnresolvedLink[] = []
  for (const wf of valid) {
    edges.push(...extractExecuteLinks(wf))
    const err = extractErrorLink(wf)
    if (err) edges.push(err)
  }
  const wh = extractWebhookHttpLinks(valid)
  edges.push(...wh.edges)
  unresolved.push(...wh.unresolved)

  const ids = new Set(valid.map(w => w.id))
  const filteredEdges = edges.filter(e => ids.has(e.source) && ids.has(e.target))
  const seen = new Set<string>()
  const keptEdges = filteredEdges.filter(e => {
    const key = `${e.source}|${e.target}|${e.type}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const inbound = new Map<string, number>()
  const outbound = new Map<string, number>()
  for (const e of keptEdges) {
    outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1)
    inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1)
  }

  const triggerNodes = valid.flatMap(wf => extractTriggerNodes(wf, catalog))

  const base = baseUrl ? stripTrailingSlash(baseUrl) : null
  const nodes: WorkflowNode[] = valid.map(wf => {
    const s = summarize(wf)
    return {
      id: wf.id,
      name: wf.name,
      active: wf.active ?? false,
      triggers: classifyTriggers(wf),
      tags: extractTags(wf),
      webhookPaths: extractWebhookPaths(wf),
      summary: {
        nodeCount: s.nodeCount,
        nodeTypes: s.nodeTypes.map(t => ({ ...t, displayName: catalog.displayName(t.type) })),
        credentials: s.credentials,
        inbound: inbound.get(wf.id) ?? 0,
        outbound: outbound.get(wf.id) ?? 0,
      },
      deepLink: base ? `${base}/workflow/${wf.id}` : null,
    }
  })

  const webhooks = buildWebhooks(valid, baseUrl)
  const schedules: ScheduleEntry[] = []
  for (const wf of valid) {
    const tz = typeof wf.settings?.timezone === 'string' ? wf.settings.timezone : 'UTC'
    for (const node of wf.nodes ?? [])
      for (const c of parseSchedule(node))
        schedules.push({ workflowId: wf.id, cadenceText: c.cadenceText, cadenceGroup: c.cadenceGroup, nextFire: from ? nextFire(c.cronExpr, from, tz) : null })
  }
  const inferredCredentials = extractCredentials(valid)
  const inferredDataTables = extractDataTables(valid)
  const apiCredentials = opts.apiCredentials ?? null
  const apiDataTables = opts.apiDataTables ?? null
  const credentials = mergeCredentials(inferredCredentials, apiCredentials)
  const dataTables = mergeDataTables(inferredDataTables, apiDataTables)

  return {
    nodes, edges: keptEdges, triggerNodes, unresolved, skipped, webhooks, schedules,
    credentials, dataTables,
    enrichment: { credentials: apiCredentials !== null, dataTables: apiDataTables !== null },
  }
}
