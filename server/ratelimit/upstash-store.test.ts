import { describe, test, expect, vi } from 'vitest'
import { createUpstashStore } from './upstash-store'

describe('createUpstashStore', () => {
  test('returns the count from the INCR result', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: 4 }, { result: 1 }],
    })
    const store = createUpstashStore({ url: 'https://u.upstash.io', token: 't', fetch })
    expect(await store.increment('ip:0', 1000)).toBe(4)
  })

  test('pipelines INCR + PEXPIRE NX with bearer auth', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ result: 1 }, { result: 1 }] })
    const store = createUpstashStore({ url: 'https://u.upstash.io/', token: 'secret', fetch })
    await store.increment('ip:0', 1500)

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://u.upstash.io/pipeline')
    expect(init.headers.Authorization).toBe('Bearer secret')
    expect(JSON.parse(init.body)).toEqual([
      ['INCR', 'ip:0'],
      ['PEXPIRE', 'ip:0', 1500, 'NX'],
    ])
  })

  test('throws when the REST call fails', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    const store = createUpstashStore({ url: 'https://u.upstash.io', token: 't', fetch })
    await expect(store.increment('ip:0', 1000)).rejects.toThrow()
  })
})
