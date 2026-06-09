import { describe, it, expect } from 'vitest'
import { tagScopedNodeIds } from './useTagScope'
import type { WorkflowNode } from '#shared/types/graph'

const node = (id: string, tags: string[] = []): WorkflowNode => ({
  id, name: id, active: true, triggers: [], tags, webhookPaths: [], deepLink: null,
  summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 },
})

// p -> a(billing) -> b -> c   ;   p -> s (sibling of a)
// d(other) -> e               ;   f(billing isolated)
const nodes = [
  node('a', ['billing']), node('b'), node('c'),
  node('p'), node('s'),
  node('d', ['other']), node('e'), node('f', ['billing']),
]
const edges = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
  { source: 'p', target: 'a' },
  { source: 'p', target: 's' },
  { source: 'd', target: 'e' },
]

describe('tagScopedNodeIds', () => {
  it('returns all node ids when no tag filter is active', () => {
    expect(tagScopedNodeIds(nodes, edges, [])).toEqual(new Set(nodes.map(n => n.id)))
  })

  it('keeps the tagged node, its descendants and its ancestors', () => {
    const r = tagScopedNodeIds(nodes, edges, ['billing'])
    // a + descendants b,c + ancestor p + isolated tagged f
    expect(r).toEqual(new Set(['a', 'b', 'c', 'p', 'f']))
  })

  it('excludes siblings reachable only by reversing then following an arrow', () => {
    const r = tagScopedNodeIds(nodes, edges, ['billing'])
    expect(r.has('s')).toBe(false)
  })

  it('excludes clusters with no tagged node', () => {
    const r = tagScopedNodeIds(nodes, edges, ['billing'])
    expect(r.has('d')).toBe(false)
    expect(r.has('e')).toBe(false)
  })

  it('keeps an isolated tagged node with no edges', () => {
    expect(tagScopedNodeIds(nodes, edges, ['billing']).has('f')).toBe(true)
  })

  it('pulls in upstream ancestors when only a downstream node is tagged', () => {
    const tagged = [node('p'), node('a'), node('b', ['billing']), node('c'), node('s')]
    const r = tagScopedNodeIds(tagged, edges, ['billing'])
    // b tagged: ancestors a,p; descendant c; sibling s excluded
    expect(r).toEqual(new Set(['b', 'c', 'a', 'p']))
  })

  it('ignores edges referencing unknown nodes', () => {
    const r = tagScopedNodeIds([node('a', ['t'])], [{ source: 'a', target: 'ghost' }], ['t'])
    expect(r).toEqual(new Set(['a']))
  })
})
