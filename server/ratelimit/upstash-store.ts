import type { RateLimitStore } from './limiter'

export interface UpstashConfig {
  url: string
  token: string
  fetch?: typeof globalThis.fetch
}

/**
 * Upstash Redis via its REST API — the only store that stays correct across
 * stateless serverless invocations (Vercel/Netlify), where in-memory counters
 * are per-instance and reset on every cold start.
 */
export function createUpstashStore({ url, token, fetch = globalThis.fetch }: UpstashConfig): RateLimitStore {
  const endpoint = `${url.replace(/\/$/, '')}/pipeline`
  return {
    async increment(key, ttlMs) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          ['INCR', key],
          ['PEXPIRE', key, ttlMs, 'NX'],
        ]),
      })
      if (!res.ok) throw new Error(`Upstash request failed: ${res.status}`)
      const [incr] = (await res.json()) as Array<{ result: number }>
      if (!incr) throw new Error('Upstash returned no INCR result')
      return incr.result
    },
  }
}
