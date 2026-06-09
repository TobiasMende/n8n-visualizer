import { isSameOrigin } from '../session/origin'

// Runs before ratelimit (alphabetical Nitro order: csrf < ratelimit). Blocks
// cross-origin state-changing calls so the ambient session cookie cannot be
// abused by another site. Read-only methods and non-API routes pass through.
export default defineEventHandler((event) => {
  const method = getMethod(event)
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return
  if (!getRequestURL(event).pathname.startsWith('/api/')) return
  if (!isSameOrigin(event))
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin request blocked' })
})
