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

  it('zero-size source produces no NaN in coordinates', () => {
    const r = floatingEdgeParams({ x: 10, y: 20, width: 0, height: 0 }, { x: 10, y: 100, width: 100, height: 40 })
    expect(Number.isFinite(r.sx)).toBe(true)
    expect(Number.isFinite(r.sy)).toBe(true)
    expect(Number.isFinite(r.tx)).toBe(true)
    expect(Number.isFinite(r.ty)).toBe(true)
  })

  it('coincident centers produce finite coords and defined sides', () => {
    const r = floatingEdgeParams({ x: 0, y: 0, width: 100, height: 40 }, { x: 0, y: 0, width: 100, height: 40 })
    expect(Number.isFinite(r.sx)).toBe(true)
    expect(Number.isFinite(r.sy)).toBe(true)
    expect(Number.isFinite(r.tx)).toBe(true)
    expect(Number.isFinite(r.ty)).toBe(true)
    expect(r.sourcePos).toBeDefined()
    expect(r.targetPos).toBeDefined()
  })
})
