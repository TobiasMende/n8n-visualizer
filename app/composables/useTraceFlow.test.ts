import { describe, it, expect } from 'vitest'
import { traceFlow } from './useTraceFlow'

const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'x' }]
const edges = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
  { source: 'd', target: 'b' },
]

describe('traceFlow', () => {
  it('returns selected + upstream + downstream', () => {
    const r = traceFlow(nodes, edges, 'b')
    expect([...r.nodeIds].sort()).toEqual(['a', 'b', 'c', 'd'])
  })
  it('includes edges among the flow nodes', () => {
    const r = traceFlow(nodes, edges, 'b')
    expect(r.edgeIds.has('a|b')).toBe(true)
    expect(r.edgeIds.has('b|c')).toBe(true)
    expect(r.edgeIds.has('d|b')).toBe(true)
  })
  it('terminates on a cycle and returns empty for null/absent', () => {
    const cyc = traceFlow([{ id: 'p' }, { id: 'q' }], [{ source: 'p', target: 'q' }, { source: 'q', target: 'p' }], 'p')
    expect([...cyc.nodeIds].sort()).toEqual(['p', 'q'])
    expect(traceFlow(nodes, edges, null).nodeIds.size).toBe(0)
    expect(traceFlow(nodes, edges, 'missing').nodeIds.size).toBe(0)
  })
})
