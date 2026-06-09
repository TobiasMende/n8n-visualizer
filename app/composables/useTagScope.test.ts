import { describe, it, expect } from 'vitest'
import { tagScopedNodeIds } from './useTagScope'
import type { WorkflowNode } from '#shared/types/graph'

const node = (id: string, tags: string[] = []): WorkflowNode => ({
  id, name: id, active: true, triggers: [], tags, webhookPaths: [], deepLink: null,
  summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 },
})

// a(billing) -> b -> c   ;   d(other) -> e   ;   f(billing isolated)
const nodes = [
  node('a', ['billing']), node('b'), node('c'),
  node('d', ['other']), node('e'), node('f', ['billing']),
]
const edges = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
  { source: 'd', target: 'e' },
]

describe('tagScopedNodeIds', () => {
  it('returns all node ids when no tag filter is active', () => {
    expect(tagScopedNodeIds(nodes, edges, [])).toEqual(new Set(['a', 'b', 'c', 'd', 'e', 'f']))
  })

  it('keeps tagged nodes and their full connected cluster (multi-hop)', () => {
    const r = tagScopedNodeIds(nodes, edges, ['billing'])
    expect(r).toEqual(new Set(['a', 'b', 'c', 'f']))
  })

  it('excludes clusters with no tagged node', () => {
    const r = tagScopedNodeIds(nodes, edges, ['billing'])
    expect(r.has('d')).toBe(false)
    expect(r.has('e')).toBe(false)
  })

  it('keeps an isolated tagged node even with no edges', () => {
    const r = tagScopedNodeIds(nodes, edges, ['billing'])
    expect(r.has('f')).toBe(true)
  })

  it('reaches the cluster from any tagged seed regardless of edge direction', () => {
    // tag only c (the downstream end) — should still pull in a and b upstream
    const tagged = [node('a'), node('b'), node('c', ['billing'])]
    const r = tagScopedNodeIds(tagged, edges, ['billing'])
    expect(r).toEqual(new Set(['a', 'b', 'c']))
  })

  it('ignores edges referencing unknown nodes', () => {
    const r = tagScopedNodeIds([node('a', ['t'])], [{ source: 'a', target: 'ghost' }], ['t'])
    expect(r).toEqual(new Set(['a']))
  })
})
