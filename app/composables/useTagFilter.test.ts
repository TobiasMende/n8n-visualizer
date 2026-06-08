import { describe, it, expect } from 'vitest'
import { allTags, matchesTags } from './useTagFilter'
import type { WorkflowNode, WorkflowGraph } from '#shared/types/graph'

const node = (tags: string[]): WorkflowNode => ({
  id: 'x', name: 'X', active: true, triggers: [], tags, webhookPaths: [], deepLink: null,
  summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 },
})

describe('allTags', () => {
  it('returns sorted unique tags across the graph', () => {
    const graph = { nodes: [node(['b', 'a']), node(['a', 'c'])], edges: [], unresolved: [], skipped: [] } as WorkflowGraph
    expect(allTags(graph)).toEqual(['a', 'b', 'c'])
  })
})

describe('matchesTags', () => {
  it('matches all nodes when no tag is selected', () => {
    expect(matchesTags(node([]), [])).toBe(true)
  })
  it('matches when the node shares any selected tag', () => {
    expect(matchesTags(node(['a', 'b']), ['b'])).toBe(true)
    expect(matchesTags(node(['a']), ['z'])).toBe(false)
  })
})
