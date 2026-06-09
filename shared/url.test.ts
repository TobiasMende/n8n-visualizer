import { describe, it, expect } from 'vitest'
import { stripTrailingSlash, isHttpUrl, safeExternalHref } from './url'

describe('stripTrailingSlash', () => {
  it('removes trailing slashes', () => {
    expect(stripTrailingSlash('https://x.com/')).toBe('https://x.com')
    expect(stripTrailingSlash('https://x.com///')).toBe('https://x.com')
    expect(stripTrailingSlash('https://x.com')).toBe('https://x.com')
  })
})

describe('isHttpUrl', () => {
  it('accepts http and https', () => {
    expect(isHttpUrl('http://x.com')).toBe(true)
    expect(isHttpUrl('https://x.com/workflow/1')).toBe(true)
  })
  it('rejects dangerous and non-http schemes', () => {
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('file:///etc/passwd')).toBe(false)
    expect(isHttpUrl('data:text/html,<script>')).toBe(false)
    expect(isHttpUrl('ftp://x.com')).toBe(false)
  })
  it('rejects non-strings and garbage', () => {
    expect(isHttpUrl(null)).toBe(false)
    expect(isHttpUrl(undefined)).toBe(false)
    expect(isHttpUrl(123)).toBe(false)
    expect(isHttpUrl('not a url')).toBe(false)
    expect(isHttpUrl('')).toBe(false)
  })
})

describe('safeExternalHref', () => {
  it('returns the url when http(s)', () => {
    expect(safeExternalHref('https://x.com/workflow/1')).toBe('https://x.com/workflow/1')
  })
  it('returns null for unsafe schemes', () => {
    expect(safeExternalHref('javascript:alert(1)')).toBeNull()
    expect(safeExternalHref(null)).toBeNull()
  })
})
