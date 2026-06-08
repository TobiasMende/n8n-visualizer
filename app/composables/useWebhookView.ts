import type { WorkflowGraph } from '#shared/types/graph'

export interface WebhookRow {
  workflowId: string; workflow: string; method: string; path: string; url: string; active: boolean
}

export function webhookRows(graph: WorkflowGraph | null): WebhookRow[] {
  if (!graph) return []
  const nameById = new Map(graph.nodes.map(n => [n.id, n]))
  return graph.webhooks.map(w => {
    const wf = nameById.get(w.workflowId)
    return {
      workflowId: w.workflowId,
      workflow: wf?.name ?? w.workflowId,
      method: w.method,
      path: w.path,
      url: w.prodUrl ?? `/webhook/${w.path}`,
      active: wf?.active ?? false,
    }
  })
}

export function callersOf(graph: WorkflowGraph | null, ownerId: string): { id: string; name: string }[] {
  if (!graph) return []
  const nameById = new Map(graph.nodes.map(n => [n.id, n.name]))
  return graph.edges
    .filter(e => e.type === 'webhookHttp' && e.target === ownerId)
    .map(e => ({ id: e.source, name: nameById.get(e.source) ?? e.source }))
}
