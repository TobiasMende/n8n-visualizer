import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force'
import type { WorkflowGraph } from '#shared/types/graph'

export interface Point { x: number; y: number }

export function computeLayout(graph: WorkflowGraph, width = 1200, height = 800): Map<string, Point> {
  const simNodes = graph.nodes.map(n => ({ id: n.id }))
  const simLinks = graph.edges.map(e => ({ source: e.source, target: e.target }))

  const sim = forceSimulation(simNodes as any)
    .force('charge', forceManyBody().strength(-320))
    .force('link', forceLink(simLinks as any).id((d: any) => d.id).distance(140))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide(64))
    .stop()

  for (let i = 0; i < 300; i++) sim.tick()

  const out = new Map<string, Point>()
  for (const n of sim.nodes() as any[]) out.set(n.id, { x: n.x, y: n.y })
  return out
}
