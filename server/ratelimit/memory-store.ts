import type { RateLimitStore } from './limiter'

export interface MemoryStore extends RateLimitStore {
  size(): number
}

/**
 * Single-process counter store. Correct on a long-lived server (VPS/container)
 * but NOT across stateless serverless invocations — use the Upstash store there.
 */
export function createMemoryStore(clock: () => number = Date.now): MemoryStore {
  const entries = new Map<string, { count: number; expiresAt: number }>()

  function sweep(now: number) {
    for (const [key, entry] of entries) if (entry.expiresAt <= now) entries.delete(key)
  }

  return {
    async increment(key, ttlMs) {
      const now = clock()
      sweep(now)
      const entry = entries.get(key)
      if (!entry || entry.expiresAt <= now) {
        entries.set(key, { count: 1, expiresAt: now + ttlMs })
        return 1
      }
      entry.count += 1
      return entry.count
    },
    size() {
      return entries.size
    },
  }
}
