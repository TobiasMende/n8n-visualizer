import { describe, it, expect } from 'vitest'
import { computeLayout } from './useForceLayout'
import type { WorkflowGraph } from '#shared/types/graph'

const graph: WorkflowGraph = {
  nodes: [
    { id: 'a', name: 'A', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 1 } },
    { id: 'b', name: 'B', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 1, outbound: 0 } },
  ],
  edges: [{ source: 'a', target: 'b', type: 'execute' }],
  unresolved: [], skipped: [],
}

describe('computeLayout', () => {
  it('returns finite positions for every node', () => {
    const pos = computeLayout(graph)
    expect(pos.size).toBe(2)
    for (const id of ['a', 'b']) {
      const p = pos.get(id)!
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })
})
