import { describe, it, expect } from 'vitest'
import { edgeColor } from './edgeColors'

describe('edgeColor', () => {
  it('returns green for execute edges', () => {
    expect(edgeColor('execute')).toBe('#3ddc97')
  })
  it('returns teal for webhookHttp edges', () => {
    expect(edgeColor('webhookHttp')).toBe('#10b981')
  })
  it('returns red for error edges', () => {
    expect(edgeColor('error')).toBe('#ef4444')
  })
  it('returns fallback for undefined', () => {
    expect(edgeColor(undefined)).toBe('#6aa0ff')
  })
  it('returns fallback for unknown type', () => {
    expect(edgeColor('xyz')).toBe('#6aa0ff')
  })
})
