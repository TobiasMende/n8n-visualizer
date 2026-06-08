import type { RawWorkflow, WorkflowSummary } from '#shared/types/graph'
import { webhookPathOf } from './webhook-path'

export function extractTags(wf: RawWorkflow): string[] {
  return (wf.tags ?? [])
    .map(t => (typeof t === 'string' ? t : t?.name))
    .filter((n): n is string => Boolean(n))
}

export function extractWebhookPaths(wf: RawWorkflow): string[] {
  return (wf.nodes ?? []).map(webhookPathOf).filter((p): p is string => p !== null)
}

export function summarize(wf: RawWorkflow): Omit<WorkflowSummary, 'inbound' | 'outbound'> {
  const counts = new Map<string, number>()
  const creds = new Set<string>()
  for (const node of wf.nodes ?? []) {
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1)
    for (const c of Object.values(node.credentials ?? {}))
      if (c?.name) creds.add(c.name)
  }
  const nodeTypes = [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
  return { nodeCount: wf.nodes?.length ?? 0, nodeTypes, credentials: [...creds] }
}
