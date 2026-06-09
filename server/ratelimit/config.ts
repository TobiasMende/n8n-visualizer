import { checkRateLimit, type RateLimitStore } from './limiter'
import { createMemoryStore } from './memory-store'
import { createUpstashStore } from './upstash-store'

export interface RateLimitEnv {
  UPSTASH_REDIS_REST_URL?: string
  UPSTASH_REDIS_REST_TOKEN?: string
  RATE_LIMIT_MAX?: string
  RATE_LIMIT_WINDOW_MS?: string
  [key: string]: string | undefined
}

export type StoreKind = 'upstash' | 'memory'

export function selectStoreKind(env: RateLimitEnv): StoreKind {
  return env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN ? 'upstash' : 'memory'
}

const LIMITED_PATHS = new Set(['/api/ingest/api', '/api/ingest/upload', '/api/session'])

export function isLimitedPath(path: string): boolean {
  return LIMITED_PATHS.has(path.split('?')[0]!)
}

export interface Limiter {
  kind: StoreKind
  limit: number
  windowMs: number
  check(key: string, now: number): ReturnType<typeof checkRateLimit>
}

let cached: Limiter | undefined

export function getLimiter(env: RateLimitEnv): Limiter {
  if (cached) return cached
  const kind = selectStoreKind(env)
  const store: RateLimitStore =
    kind === 'upstash'
      ? createUpstashStore({ url: env.UPSTASH_REDIS_REST_URL!, token: env.UPSTASH_REDIS_REST_TOKEN! })
      : createMemoryStore()
  const limit = Number(env.RATE_LIMIT_MAX) || 30
  const windowMs = Number(env.RATE_LIMIT_WINDOW_MS) || 60_000
  cached = { kind, limit, windowMs, check: (key, now) => checkRateLimit(store, key, { limit, windowMs, now }) }
  return cached
}
