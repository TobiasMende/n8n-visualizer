import type { WorkflowNode } from '#shared/types/graph'
import { matchesTags } from './useTagFilter'

interface ScopeEdge { source: string; target: string }

function reach(starts: string[], adj: Map<string, string[]>): Set<string> {
  const seen = new Set(starts)
  const stack = [...starts]
  while (stack.length) {
    const id = stack.pop()!
    for (const nb of adj.get(id) ?? []) {
      if (!seen.has(nb)) { seen.add(nb); stack.push(nb) }
    }
  }
  return seen
}

// When a tag filter is active, the graph is restricted to the directed lineage
// of the tagged workflows: each tagged workflow, everything it reaches by
// following edge arrows out (descendants), and everything that reaches it by
// following arrows in (ancestors). Siblings — nodes reachable only by going
// against an arrow and then with one — are excluded. With no tag filter, all
// node ids are returned unchanged.
export function tagScopedNodeIds(
  nodes: WorkflowNode[],
  edges: ScopeEdge[],
  tagFilter: string[],
): Set<string> {
  const all = new Set(nodes.map(n => n.id))
  if (!tagFilter.length) return all

  const out = new Map<string, string[]>()
  const inc = new Map<string, string[]>()
  const link = (m: Map<string, string[]>, a: string, b: string) => {
    const list = m.get(a)
    if (list) list.push(b)
    else m.set(a, [b])
  }
  for (const e of edges) {
    if (!all.has(e.source) || !all.has(e.target)) continue
    link(out, e.source, e.target)
    link(inc, e.target, e.source)
  }

  const seeds = nodes.filter(n => matchesTags(n, tagFilter)).map(n => n.id)
  const keep = reach(seeds, out)
  for (const id of reach(seeds, inc)) keep.add(id)
  return keep
}
