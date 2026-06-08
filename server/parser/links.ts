import type { RawWorkflow, WorkflowEdge, UnresolvedLink } from '#shared/types/graph'
import { webhookPathOf } from './webhook-path'

function resolveWorkflowId(param: unknown): string | null {
  if (typeof param === 'string') return param || null
  if (param && typeof param === 'object' && 'value' in (param as object)) {
    const v = (param as Record<string, unknown>).value
    return typeof v === 'string' && v ? v : null
  }
  return null
}

export function extractExecuteLinks(wf: RawWorkflow): WorkflowEdge[] {
  const edges: WorkflowEdge[] = []
  for (const node of wf.nodes ?? []) {
    if (node.type !== 'n8n-nodes-base.executeWorkflow') continue
    const target = resolveWorkflowId(node.parameters?.workflowId)
    if (target) edges.push({ source: wf.id, target, type: 'execute' })
  }
  return edges
}

export function extractErrorLink(wf: RawWorkflow): WorkflowEdge | null {
  const target = wf.settings?.errorWorkflow
  return target ? { source: wf.id, target, type: 'error' } : null
}

export interface WebhookHttpResult { edges: WorkflowEdge[]; unresolved: UnresolvedLink[] }

function pathFromUrl(url: string): string | null {
  const m = url.match(/\/webhook(?:-test)?\/([^?#\s]+)/)
  return m ? m[1].replace(/\/+$/, '') : null
}

export function extractWebhookHttpLinks(workflows: RawWorkflow[]): WebhookHttpResult {
  const pathToWf = new Map<string, string[]>()
  for (const wf of workflows)
    for (const node of wf.nodes ?? []) {
      const p = webhookPathOf(node)
      if (p) {
        const existing = pathToWf.get(p)
        if (existing) existing.push(wf.id)
        else pathToWf.set(p, [wf.id])
      }
    }

  const edges: WorkflowEdge[] = []
  const unresolved: UnresolvedLink[] = []
  for (const wf of workflows)
    for (const node of wf.nodes ?? []) {
      if (node.type !== 'n8n-nodes-base.httpRequest') continue
      const url = node.parameters?.url
      if (typeof url !== 'string' || !url) continue
      if (url.startsWith('=') || url.includes('{{')) {
        unresolved.push({ workflowId: wf.id, nodeName: node.name, reason: 'URL built from expression' })
        continue
      }
      const p = pathFromUrl(url)
      if (!p) continue
      let candidate: string | undefined = p
      let targets: string[] | undefined
      while (candidate !== undefined) {
        targets = pathToWf.get(candidate)
        if (targets) break
        const slash = candidate.lastIndexOf('/')
        candidate = slash === -1 ? undefined : candidate.slice(0, slash)
      }
      if (targets) {
        for (const target of targets)
          if (target !== wf.id) edges.push({ source: wf.id, target, type: 'webhookHttp' })
      }
    }
  return { edges, unresolved }
}
