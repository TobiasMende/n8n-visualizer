import { getRequestHeader, getRequestURL, type H3Event } from 'h3'

// A missing Origin is allowed: non-browser clients and same-origin top-level
// GETs send none, and the session cookie's SameSite=Strict already guards the
// cookie path. A present Origin must exactly match the request's own origin.
export function originsMatch(origin: string | undefined, requestOrigin: string): boolean {
  if (!origin) return true
  try { return new URL(origin).origin === requestOrigin } catch { return false }
}

export function isSameOrigin(event: H3Event): boolean {
  return originsMatch(getRequestHeader(event, 'origin'), getRequestURL(event).origin)
}
