import type { WorkflowGraph } from '#shared/types/graph'

export interface OverlayNode { id: string; kind: 'credential' | 'nodeType'; label: string; x: number; y: number }
export interface OverlayEdge { id: string; source: string; target: string; kind: 'uses' | 'contains' }
interface Point { x: number; y: number }

export function overlayNodesAndEdges(
  graph: WorkflowGraph,
  basePos: Map<string, Point>,
  layers: { credentials: boolean; nodeTypes: boolean },
): { nodes: OverlayNode[]; edges: OverlayEdge[] } {
  const nodes: OverlayNode[] = []
  const edges: OverlayEdge[] = []
  const seen = new Set<string>()

  const place = (parentId: string, i: number): Point => {
    const p = basePos.get(parentId) ?? { x: 0, y: 0 }
    const angle = (i % 8) * (Math.PI / 4)
    return { x: p.x + Math.cos(angle) * 90, y: p.y + Math.sin(angle) * 90 }
  }

  if (layers.credentials) {
    for (const c of graph.credentials) {
      const id = `cred:${c.type}:${c.name}`
      if (!seen.has(id)) {
        const pos = place(c.workflowIds[0] ?? '', nodes.length)
        nodes.push({ id, kind: 'credential', label: c.name, x: pos.x, y: pos.y })
        seen.add(id)
      }
      for (const wfId of c.workflowIds) edges.push({ id: `e:${wfId}:${id}`, source: wfId, target: id, kind: 'uses' })
    }
  }

  if (layers.nodeTypes) {
    for (const n of graph.nodes) {
      for (const t of n.summary.nodeTypes) {
        const id = `type:${t.type}`
        if (!seen.has(id)) {
          const pos = place(n.id, nodes.length)
          nodes.push({ id, kind: 'nodeType', label: t.displayName, x: pos.x, y: pos.y })
          seen.add(id)
        }
        edges.push({ id: `e:${n.id}:${id}`, source: n.id, target: id, kind: 'contains' })
      }
    }
  }

  return { nodes, edges }
}
