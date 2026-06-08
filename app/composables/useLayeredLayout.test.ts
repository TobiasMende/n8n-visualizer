import { describe, it, expect } from 'vitest'
import { computeLayeredLayout } from './useLayeredLayout'

describe('computeLayeredLayout', () => {
  it('places every node', () => {
    const pos = computeLayeredLayout([{ id: 'a' }, { id: 'b' }, { id: 'c' }], [{ source: 'a', target: 'b' }])
    expect(pos.size).toBe(3)
    for (const id of ['a', 'b', 'c']) {
      expect(Number.isFinite(pos.get(id)!.x)).toBe(true)
      expect(Number.isFinite(pos.get(id)!.y)).toBe(true)
    }
  })
  it('ranks an entry node above its target (smaller y, top-down)', () => {
    const pos = computeLayeredLayout([{ id: 'entry' }, { id: 'child' }], [{ source: 'entry', target: 'child' }])
    expect(pos.get('entry')!.y).toBeLessThan(pos.get('child')!.y)
  })
  it('ignores edges referencing unknown nodes and self-loops', () => {
    const pos = computeLayeredLayout([{ id: 'a' }], [{ source: 'a', target: 'ghost' }, { source: 'a', target: 'a' }])
    expect(pos.size).toBe(1)
  })
})
