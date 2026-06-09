import { describe, test, expect } from 'vitest'
import { selectStoreKind, isLimitedPath } from './config'

describe('selectStoreKind', () => {
  test('uses upstash when both REST env vars are present', () => {
    expect(selectStoreKind({
      UPSTASH_REDIS_REST_URL: 'https://u.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 't',
    })).toBe('upstash')
  })

  test('falls back to memory when env vars are missing', () => {
    expect(selectStoreKind({})).toBe('memory')
    expect(selectStoreKind({ UPSTASH_REDIS_REST_URL: 'https://u.upstash.io' })).toBe('memory')
  })
})

describe('isLimitedPath', () => {
  test('limits the expensive ingest endpoints', () => {
    expect(isLimitedPath('/api/ingest/api')).toBe(true)
    expect(isLimitedPath('/api/ingest/upload')).toBe(true)
  })

  it('limits the session connect route', () => {
    expect(isLimitedPath('/api/session')).toBe(true)
  })

  test('does not limit other routes', () => {
    expect(isLimitedPath('/')).toBe(false)
    expect(isLimitedPath('/api/_nuxt_icon')).toBe(false)
  })
})
