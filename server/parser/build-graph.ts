import type {
  RawWorkflow, WorkflowGraph, WorkflowNode, WorkflowEdge,
  UnresolvedLink, SkippedWorkflow,
} from '#shared/types/graph'
import { classifyTriggers } from './triggers'
import { extractExecuteLinks, extractErrorLink, extractWebhookHttpLinks } from './links'
import { summarize, extractTags, extractWebhookPaths } from './summarize'

export function buildGraph(workflows: RawWorkflow[], baseUrl: string | null): WorkflowGraph {
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
  const keptEdges = edges.filter(e => ids.has(e.source) && ids.has(e.target))

  const inbound = new Map<string, number>()
  const outbound = new Map<string, number>()
  for (const e of keptEdges) {
    outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1)
    inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1)
  }

  const base = baseUrl ? baseUrl.replace(/\/+$/, '') : null
  const nodes: WorkflowNode[] = valid.map(wf => ({
    id: wf.id,
    name: wf.name,
    active: wf.active ?? false,
    triggers: classifyTriggers(wf),
    tags: extractTags(wf),
    webhookPaths: extractWebhookPaths(wf),
    summary: { ...summarize(wf), inbound: inbound.get(wf.id) ?? 0, outbound: outbound.get(wf.id) ?? 0 },
    deepLink: base ? `${base}/workflow/${wf.id}` : null,
  }))

  return { nodes, edges: keptEdges, unresolved, skipped }
}
