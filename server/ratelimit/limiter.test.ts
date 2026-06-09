import { describe, test, expect } from 'vitest'
import { checkRateLimit, type RateLimitStore } from './limiter'

function fakeStore(): RateLimitStore & { keys: Map<string, number> } {
  const keys = new Map<string, number>()
  return {
    keys,
    async increment(key) {
      const next = (keys.get(key) ?? 0) + 1
      keys.set(key, next)
      return next
    },
  }
}

describe('checkRateLimit', () => {
  test('allows requests up to the limit', async () => {
    const store = fakeStore()
    const opts = { limit: 3, windowMs: 1000, now: 0 }
    expect((await checkRateLimit(store, 'ip', opts)).allowed).toBe(true)
    expect((await checkRateLimit(store, 'ip', opts)).allowed).toBe(true)
    expect((await checkRateLimit(store, 'ip', opts)).allowed).toBe(true)
  })

  test('blocks the request that exceeds the limit', async () => {
    const store = fakeStore()
    const opts = { limit: 2, windowMs: 1000, now: 0 }
    await checkRateLimit(store, 'ip', opts)
    await checkRateLimit(store, 'ip', opts)
    const third = await checkRateLimit(store, 'ip', opts)
    expect(third.allowed).toBe(false)
    expect(third.remaining).toBe(0)
  })

  test('reports remaining count', async () => {
    const store = fakeStore()
    const r = await checkRateLimit(store, 'ip', { limit: 5, windowMs: 1000, now: 0 })
    expect(r.remaining).toBe(4)
    expect(r.limit).toBe(5)
  })

  test('retryAfterMs is the time until the window resets when blocked', async () => {
    const store = fakeStore()
    const opts = { limit: 1, windowMs: 1000, now: 250 }
    await checkRateLimit(store, 'ip', opts)
    const blocked = await checkRateLimit(store, 'ip', opts)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBe(750)
  })

  test('separate keys are limited independently', async () => {
    const store = fakeStore()
    const opts = { limit: 1, windowMs: 1000, now: 0 }
    expect((await checkRateLimit(store, 'a', opts)).allowed).toBe(true)
    expect((await checkRateLimit(store, 'b', opts)).allowed).toBe(true)
  })

  test('a new window resets the count', async () => {
    const store = fakeStore()
    expect((await checkRateLimit(store, 'ip', { limit: 1, windowMs: 1000, now: 500 })).allowed).toBe(true)
    expect((await checkRateLimit(store, 'ip', { limit: 1, windowMs: 1000, now: 500 })).allowed).toBe(false)
    expect((await checkRateLimit(store, 'ip', { limit: 1, windowMs: 1000, now: 1500 })).allowed).toBe(true)
  })
})
