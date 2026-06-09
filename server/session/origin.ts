import { getRequestHeader, getRequestURL, type H3Event } from 'h3'

// Missing Origin is allowed (non-browser clients / same-origin GETs send none;
// SameSite=Strict guards the cookie). A present Origin must match exactly.
export function originsMatch(origin: string | undefined, requestOrigin: string): boolean {
  if (!origin) return true
  try { return new URL(origin).origin === requestOrigin } catch { return false }
}

export function isSameOrigin(event: H3Event): boolean {
  try {
    return originsMatch(getRequestHeader(event, 'origin'), getRequestURL(event).origin)
  } catch {
    return false
  }
}
