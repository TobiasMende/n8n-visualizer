import { describe, it, expect } from 'vitest'
import { sessionConfig } from './store'

describe('sessionConfig', () => {
  it('produces a hardened 7-day cookie in production', () => {
    const c = sessionConfig('x'.repeat(32), false)
    expect(c.name).toBe('n8nviz_sess')
    expect(c.password).toHaveLength(32)
    expect(c.cookie).toMatchObject({
      httpOnly: true, secure: true, sameSite: 'strict', maxAge: 60 * 60 * 24 * 7,
    })
    expect(c.maxAge).toBe(60 * 60 * 24 * 7)
  })
  it('drops the Secure flag in dev (no TLS on localhost)', () => {
    expect(sessionConfig('x'.repeat(32), true).cookie.secure).toBe(false)
  })
})
