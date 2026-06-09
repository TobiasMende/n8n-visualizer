import { getLimiter, isLimitedPath } from '../ratelimit/config'

let warned = false

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!isLimitedPath(path)) return

  const limiter = getLimiter(process.env)
  if (limiter.kind === 'memory' && !warned) {
    warned = true
    console.warn(
      '[ratelimit] using in-memory store — correct on a single long-lived server, ' +
        'but per-instance and reset on cold start in serverless. ' +
        'Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for a shared store.',
    )
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'

  let result
  try {
    result = await limiter.check(`ingest:${ip}`, Date.now())
  } catch (err) {
    console.error('[ratelimit] store error — failing open', err)
    return
  }

  setResponseHeader(event, 'X-RateLimit-Limit', String(result.limit))
  setResponseHeader(event, 'X-RateLimit-Remaining', String(result.remaining))

  if (!result.allowed) {
    const retryAfter = Math.ceil(result.retryAfterMs / 1000)
    setResponseHeader(event, 'Retry-After', retryAfter)
    throw createError({ statusCode: 429, statusMessage: 'Too many requests' })
  }
})
