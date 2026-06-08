import { describe, it, expect } from 'vitest'
import { normalizeWorkflows } from './normalize'

describe('normalizeWorkflows', () => {
  it('passes through an array unchanged', () => {
    const arr = [{ id: 'a', name: 'A', nodes: [] }]
    expect(normalizeWorkflows(arr)).toEqual(arr)
  })

  it('unwraps an n8n API/export { data: [...] } bundle', () => {
    const arr = [{ id: 'a', name: 'A', nodes: [] }]
    expect(normalizeWorkflows({ data: arr })).toEqual(arr)
  })

  it('wraps a single workflow object into an array', () => {
    const one = { id: 'a', name: 'A', nodes: [] }
    expect(normalizeWorkflows(one)).toEqual([one])
  })

  it('returns [] for unrecognized input', () => {
    expect(normalizeWorkflows(42)).toEqual([])
    expect(normalizeWorkflows(null)).toEqual([])
  })
})
