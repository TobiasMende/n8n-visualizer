import { describe, it, expect } from 'vitest'
import { resolveIngestCreds } from './creds'

describe('resolveIngestCreds', () => {
  const session = { baseUrl: 'https://s', apiKey: 'sk' }
  it('prefers complete body creds over the session', () => {
    expect(resolveIngestCreds({ baseUrl: 'https://b', apiKey: 'bk' }, session))
      .toEqual({ baseUrl: 'https://b', apiKey: 'bk' })
  })
  it('falls back to the session when the body lacks creds', () => {
    expect(resolveIngestCreds({}, session)).toEqual(session)
    expect(resolveIngestCreds(null, session)).toEqual(session)
    expect(resolveIngestCreds({ baseUrl: 'https://b' }, session)).toEqual(session)
  })
  it('returns null when neither has complete creds', () => {
    expect(resolveIngestCreds({ baseUrl: 'https://b' }, null)).toBeNull()
    expect(resolveIngestCreds(null, null)).toBeNull()
  })
  it('ignores non-string body fields', () => {
    expect(resolveIngestCreds({ baseUrl: 1, apiKey: 2 } as any, session)).toEqual(session)
  })
})
