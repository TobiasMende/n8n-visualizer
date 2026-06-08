import { describe, it, expect } from 'vitest'
import { neighbors } from './useNeighbors'

const edges = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
  { source: 'd', target: 'a' },
]

describe('neighbors', () => {
  it('returns the node + its 1-hop neighbors both directions', () => {
    const r = neighbors(edges, 'a')
    expect([...r.nodeIds].sort()).toEqual(['a', 'b', 'd'])
  })
  it('returns the connecting edge ids', () => {
    const r = neighbors(edges, 'a')
    expect(r.edgeIds.has('a|b')).toBe(true)
    expect(r.edgeIds.has('d|a')).toBe(true)
    expect(r.edgeIds.has('b|c')).toBe(false)
  })
  it('returns empty for null/absent', () => {
    expect(neighbors(edges, null).nodeIds.size).toBe(0)
  })
})
