import type { WorkflowNode } from '#shared/types/graph'
import { matchesTags } from './useTagFilter'

interface ScopeEdge { source: string; target: string }

// When a tag filter is active, the visible graph is restricted to the tagged
// workflows plus every workflow reachable from them through edges (undirected,
// multi-hop) — the full connected cluster a tag participates in. With no tag
// filter, all node ids are returned unchanged.
export function tagScopedNodeIds(
  nodes: WorkflowNode[],
  edges: ScopeEdge[],
  tagFilter: string[],
): Set<string> {
  const all = new Set(nodes.map(n => n.id))
  if (!tagFilter.length) return all

  const adj = new Map<string, string[]>()
  const link = (a: string, b: string) => {
    const list = adj.get(a)
    if (list) list.push(b)
    else adj.set(a, [b])
  }
  for (const e of edges) {
    if (!all.has(e.source) || !all.has(e.target)) continue
    link(e.source, e.target)
    link(e.target, e.source)
  }

  const keep = new Set<string>()
  const stack: string[] = []
  for (const n of nodes) {
    if (matchesTags(n, tagFilter)) { keep.add(n.id); stack.push(n.id) }
  }
  while (stack.length) {
    const id = stack.pop()!
    for (const nb of adj.get(id) ?? []) {
      if (!keep.has(nb)) { keep.add(nb); stack.push(nb) }
    }
  }
  return keep
}
