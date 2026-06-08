interface FNode { id: string }
interface FEdge { source: string; target: string }

export function traceFlow(
  nodes: FNode[], edges: FEdge[], selectedId: string | null,
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  if (!selectedId || !nodes.some(n => n.id === selectedId)) return { nodeIds, edgeIds }

  const walk = (start: string, dir: 'down' | 'up') => {
    const stack = [start]
    const seen = new Set<string>([start])
    while (stack.length) {
      const cur = stack.pop()!
      nodeIds.add(cur)
      for (const e of edges) {
        const next = dir === 'down' ? (e.source === cur ? e.target : null)
                                    : (e.target === cur ? e.source : null)
        if (next && !seen.has(next)) { seen.add(next); stack.push(next) }
      }
    }
  }
  walk(selectedId, 'down')
  walk(selectedId, 'up')

  for (const e of edges)
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) edgeIds.add(`${e.source}|${e.target}`)

  return { nodeIds, edgeIds }
}
