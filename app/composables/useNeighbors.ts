interface NEdge { source: string; target: string }

export function neighbors(edges: NEdge[], id: string | null): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  if (!id) return { nodeIds, edgeIds }
  nodeIds.add(id)
  for (const e of edges) {
    if (e.source === id) { nodeIds.add(e.target); edgeIds.add(`${e.source}|${e.target}`) }
    if (e.target === id) { nodeIds.add(e.source); edgeIds.add(`${e.source}|${e.target}`) }
  }
  return { nodeIds, edgeIds }
}
