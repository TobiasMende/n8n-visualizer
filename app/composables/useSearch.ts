import type { WorkflowGraph } from '#shared/types/graph'

export interface SearchHit { workflowId: string; label: string; kind: 'name' | 'webhook' | 'node' }

export function searchGraph(graph: WorkflowGraph | null, query: string): SearchHit[] {
  const term = query.trim().toLowerCase()
  if (!term || !graph) return []
  const hits: SearchHit[] = []
  for (const n of graph.nodes) {
    if (n.name.toLowerCase().includes(term))
      hits.push({ workflowId: n.id, label: n.name, kind: 'name' })
    for (const p of n.webhookPaths)
      if (p.toLowerCase().includes(term))
        hits.push({ workflowId: n.id, label: `webhook: ${p}`, kind: 'webhook' })
    for (const nt of n.summary.nodeTypes)
      if (nt.type.toLowerCase().includes(term))
        hits.push({ workflowId: n.id, label: `${nt.type} (×${nt.count})`, kind: 'node' })
  }
  return hits
}
