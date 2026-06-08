import type { WorkflowGraph } from '#shared/types/graph'

export interface LinkItem { id: string; name: string; type: string }

export function workflowLinks(graph: WorkflowGraph | null, id: string): { inbound: LinkItem[]; outbound: LinkItem[] } {
  if (!graph) return { inbound: [], outbound: [] }
  const nameById = new Map(graph.nodes.map(n => [n.id, n.name]))
  const inbound: LinkItem[] = []
  const outbound: LinkItem[] = []
  for (const e of graph.edges) {
    if (e.target === id) inbound.push({ id: e.source, name: nameById.get(e.source) ?? e.source, type: e.type })
    if (e.source === id) outbound.push({ id: e.target, name: nameById.get(e.target) ?? e.target, type: e.type })
  }
  return { inbound, outbound }
}
