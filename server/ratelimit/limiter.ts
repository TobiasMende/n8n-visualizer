export interface RateLimitStore {
  /** Atomically increment the counter at `key`, expiring it after `ttlMs`, and return the new count. */
  increment(key: string, ttlMs: number): Promise<number>
}

export interface RateLimitOptions {
  limit: number
  windowMs: number
  now: number
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  retryAfterMs: number
}

export async function checkRateLimit(
  store: RateLimitStore,
  key: string,
  { limit, windowMs, now }: RateLimitOptions,
): Promise<RateLimitResult> {
  const windowStart = Math.floor(now / windowMs) * windowMs
  const count = await store.increment(`${key}:${windowStart}`, windowMs)
  const allowed = count <= limit
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - count),
    retryAfterMs: allowed ? 0 : windowStart + windowMs - now,
  }
}
