interface FNode { id: string }
interface FEdge { source: string; target: string }

export function traceFlow(
  nodes: FNode[], edges: FEdge[], selectedId: string | null,
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  if (!selectedId || !nodes.some(n => n.id === selectedId)) return { nodeIds, edgeIds }

  const downAdj = new Map<string, string[]>()
  const upAdj = new Map<string, string[]>()
  const push = (m: Map<string, string[]>, k: string, v: string) => {
    const a = m.get(k); if (a) a.push(v); else m.set(k, [v])
  }
  for (const e of edges) { push(downAdj, e.source, e.target); push(upAdj, e.target, e.source) }

  const walk = (start: string, adj: Map<string, string[]>) => {
    const stack = [start]
    const seen = new Set<string>([start])
    while (stack.length) {
      const cur = stack.pop()!
      nodeIds.add(cur)
      for (const next of adj.get(cur) ?? [])
        if (!seen.has(next)) { seen.add(next); stack.push(next) }
    }
  }
  walk(selectedId, downAdj)
  walk(selectedId, upAdj)

  for (const e of edges)
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) edgeIds.add(`${e.source}|${e.target}`)

  return { nodeIds, edgeIds }
}
