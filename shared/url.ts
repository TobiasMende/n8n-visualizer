export function stripTrailingSlash(url: string): string { return url.replace(/\/+$/, '') }

export function isHttpUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function safeExternalHref(url: unknown): string | null {
  return isHttpUrl(url) ? url : null
}
