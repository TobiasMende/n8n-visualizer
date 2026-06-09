import { describe, it, expect, vi } from 'vitest'
import { isBlockedIp, assertSafeUrl, safeFetch, SafeFetchError, type ResolvedAddr } from './safe-fetch'

const v4 = (address: string): ResolvedAddr[] => [{ address, family: 4 }]

describe('isBlockedIp', () => {
  const blocked = [
    '127.0.0.1', '127.1.2.3', '10.0.0.1', '172.16.5.5', '172.31.255.255',
    '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '255.255.255.255',
    '224.0.0.1', '::1', '::', 'fc00::1', 'fd12:3456::1', 'fe80::1',
    'ff02::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'not-an-ip',
  ]
  const allowed = [
    '8.8.8.8', '1.1.1.1', '203.0.113.5', '172.32.0.1', '172.15.0.1',
    '11.0.0.1', '2606:4700:4700::1111', '2001:4860:4860::8888',
  ]
  it.each(blocked)('blocks %s', (ip) => expect(isBlockedIp(ip)).toBe(true))
  it.each(allowed)('allows %s', (ip) => expect(isBlockedIp(ip)).toBe(false))
})

describe('assertSafeUrl', () => {
  it('accepts http(s)', () => {
    expect(assertSafeUrl('https://n8n.example.com').hostname).toBe('n8n.example.com')
    expect(assertSafeUrl('http://x.com:5678/api').hostname).toBe('x.com')
  })
  it('rejects non-http schemes', () => {
    expect(() => assertSafeUrl('javascript:alert(1)')).toThrow(SafeFetchError)
    expect(() => assertSafeUrl('file:///etc/passwd')).toThrow(SafeFetchError)
  })
  it('rejects embedded credentials', () => {
    expect(() => assertSafeUrl('http://user:pass@x.com')).toThrow(SafeFetchError)
  })
  it('rejects garbage', () => {
    expect(() => assertSafeUrl('not a url')).toThrow(SafeFetchError)
  })
})

describe('safeFetch', () => {
  it('rejects a host that resolves to a private IP, without fetching', async () => {
    const fetchImpl = vi.fn()
    await expect(
      safeFetch('http://evil.test', {}, { resolve: async () => v4('10.0.0.5'), fetchImpl }),
    ).rejects.toMatchObject({ kind: 'blocked' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('re-validates redirect targets and blocks a redirect to a private IP', async () => {
    const resolve = vi.fn()
      .mockResolvedValueOnce(v4('203.0.113.9'))
      .mockResolvedValueOnce(v4('10.0.0.5'))
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'http://internal.test/' } }),
    )
    await expect(
      safeFetch('http://evil.test', {}, { resolve, fetchImpl }),
    ).rejects.toMatchObject({ kind: 'blocked' })
    expect(resolve).toHaveBeenCalledTimes(2)
  })

  it('follows an allowed redirect to a public host', async () => {
    const resolve = vi.fn().mockResolvedValue(v4('203.0.113.9'))
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://b.test/x' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: 1 }), { status: 200 }))
    const res = await safeFetch('http://a.test', {}, { resolve, fetchImpl })
    expect(await res.json()).toEqual({ ok: 1 })
  })

  it('aborts when the response exceeds the size cap (content-length)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response('x', { status: 200, headers: { 'content-length': String(50 * 1024 * 1024) } }),
    )
    const res = await safeFetch('http://ok.test', {}, { resolve: async () => v4('203.0.113.9'), fetchImpl })
    await expect(res.text()).rejects.toMatchObject({ kind: 'too_large' })
  })

  it('aborts when a streamed response exceeds the size cap', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('0123456789', { status: 200 }))
    const res = await safeFetch('http://ok.test', { maxResponseBytes: 4 }, { resolve: async () => v4('203.0.113.9'), fetchImpl })
    await expect(res.text()).rejects.toMatchObject({ kind: 'too_large' })
  })

  it('returns parsed JSON for an allowed host', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: '1' }] }), { status: 200 }),
    )
    const res = await safeFetch('https://ok.test/api', {}, { resolve: async () => v4('203.0.113.9'), fetchImpl })
    expect(res.ok).toBe(true)
    expect(await res.json()).toEqual({ data: [{ id: '1' }] })
  })

  it('throws too_many_redirects past the hop limit', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'http://loop.test/' } }),
    )
    await expect(
      safeFetch('http://loop.test', {}, { resolve: async () => v4('203.0.113.9'), fetchImpl }),
    ).rejects.toMatchObject({ kind: 'too_many_redirects' })
  })
})
