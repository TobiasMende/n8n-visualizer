import { describe, it, expect } from 'vitest'
import { floatingEdgeParams } from './useFloatingEdge'

describe('floatingEdgeParams', () => {
  it('connects bottom→top when target is directly below', () => {
    const r = floatingEdgeParams({ x: 0, y: 0, width: 100, height: 40 }, { x: 0, y: 200, width: 100, height: 40 })
    expect(r.sourcePos).toBe('bottom')
    expect(r.targetPos).toBe('top')
  })
  it('connects right→left when target is to the right', () => {
    const r = floatingEdgeParams({ x: 0, y: 0, width: 100, height: 40 }, { x: 300, y: 0, width: 100, height: 40 })
    expect(r.sourcePos).toBe('right')
    expect(r.targetPos).toBe('left')
  })
  it('connection points sit on the node borders', () => {
    const r = floatingEdgeParams({ x: 0, y: 0, width: 100, height: 40 }, { x: 0, y: 200, width: 100, height: 40 })
    expect(r.sy).toBeCloseTo(40, 0)   // source bottom edge
    expect(r.ty).toBeCloseTo(200, 0)  // target top edge
  })
})
