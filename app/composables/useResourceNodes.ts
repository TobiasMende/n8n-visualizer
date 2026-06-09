import type { WorkflowGraph } from '#shared/types/graph'

export interface ResourceNode {
  id: string
  kind: 'credential' | 'dataTable'
  label: string
  workflowIds: string[]
}
export interface ResourceEdge {
  source: string
  target: string
  kind: 'credential' | 'dataTable'
}

export function resourceNodes(
  graph: WorkflowGraph | null,
  show: { credentials: boolean; dataTables: boolean },
  keep: Set<string>,
): { nodes: ResourceNode[]; edges: ResourceEdge[] } {
  const nodes: ResourceNode[] = []
  const edges: ResourceEdge[] = []
  if (!graph) return { nodes, edges }

  if (show.credentials) {
    for (const c of graph.credentials) {
      const wfs = c.workflowIds.filter(id => keep.has(id))
      if (!wfs.length) continue
      const id = `cred:${c.type}:${c.id ?? c.name}`
      nodes.push({ id, kind: 'credential', label: c.name, workflowIds: wfs })
      for (const wf of wfs) edges.push({ source: wf, target: id, kind: 'credential' })
    }
  }

  if (show.dataTables) {
    for (const t of graph.dataTables) {
      const wfs = t.workflowIds.filter(id => keep.has(id))
      if (!wfs.length) continue
      const id = `datatable:${t.id}`
      nodes.push({ id, kind: 'dataTable', label: t.name, workflowIds: wfs })
      for (const wf of wfs) edges.push({ source: wf, target: id, kind: 'dataTable' })
    }
  }

  return { nodes, edges }
}
