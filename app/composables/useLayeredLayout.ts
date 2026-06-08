import { graphlib, layout } from '@dagrejs/dagre'

interface Point { x: number; y: number }
interface LNode { id: string }
interface LEdge { source: string; target: string }

export function computeLayeredLayout(
  nodes: LNode[],
  edges: LEdge[],
  opts: { nodeWidth?: number; nodeHeight?: number } = {},
): Map<string, Point> {
  const w = opts.nodeWidth ?? 170
  const h = opts.nodeHeight ?? 46
  const g = new graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 90, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))

  const ids = new Set(nodes.map(n => n.id))
  for (const n of nodes) g.setNode(n.id, { width: w, height: h })
  for (const e of edges)
    if (e.source !== e.target && ids.has(e.source) && ids.has(e.target)) g.setEdge(e.source, e.target)

  layout(g)

  const out = new Map<string, Point>()
  for (const n of nodes) {
    const p = g.node(n.id)
    if (p) out.set(n.id, { x: p.x, y: p.y })
  }
  return out
}
