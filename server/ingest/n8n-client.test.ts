import { describe, it, expect, vi } from 'vitest'
import { fetchAllWorkflows, fetchAllCredentials, fetchAllDataTables } from './n8n-client'
import type { SafeResponse } from './safe-fetch'

const resp = (status: number, json: unknown): SafeResponse => ({
  status,
  ok: status >= 200 && status < 300,
  headers: new Headers(),
  text: async () => JSON.stringify(json),
  json: async () => json,
})

describe('fetchAllWorkflows', () => {
  it('follows nextCursor pagination and concatenates pages', async () => {
    const pages = [
      { data: [{ id: 'a', name: 'A', nodes: [] }], nextCursor: 'cur2' },
      { data: [{ id: 'b', name: 'B', nodes: [] }], nextCursor: null },
    ]
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(resp(200, pages[0]))
      .mockResolvedValueOnce(resp(200, pages[1]))

    const got = await fetchAllWorkflows('https://n8n.example.com', 'key', fetchImpl)
    expect(got.map(w => w.id)).toEqual(['a', 'b'])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/v1/workflows')
  })

  it('requests a bounded page size and a raised response cap for large instances', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(200, { data: [], nextCursor: null }))
    await fetchAllWorkflows('https://n8n.example.com', 'key', fetchImpl)
    const call = fetchImpl.mock.calls[0]!
    const url = call[0] as string
    const opts = call[1] as { maxResponseBytes?: number }
    expect(url).toContain('limit=100')
    expect(opts.maxResponseBytes).toBeGreaterThanOrEqual(50 * 1024 * 1024)
  })

  it('bounds the whole pagination with one shared deadline, not a fresh timeout per page', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(resp(200, { data: [{ id: 'a', name: 'A', nodes: [] }], nextCursor: 'c2' }))
      .mockResolvedValueOnce(resp(200, { data: [{ id: 'b', name: 'B', nodes: [] }], nextCursor: 'c3' }))
      .mockResolvedValueOnce(resp(200, { data: [{ id: 'c', name: 'C', nodes: [] }], nextCursor: null }))

    await fetchAllWorkflows('https://n8n.example.com', 'key', fetchImpl)

    const signals = fetchImpl.mock.calls.map(c => (c[1] as { signal?: AbortSignal }).signal)
    expect(signals).toHaveLength(3)
    expect(signals[0]).toBeInstanceOf(AbortSignal)
    expect(signals.every(s => s === signals[0])).toBe(true)
  })

  it('stops paginating once the shared deadline has aborted', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (_url, opts) => {
      if (opts?.signal?.aborted) throw new Error('aborted')
      return resp(200, { data: [{ id: 'a', name: 'A', nodes: [] }], nextCursor: 'next' })
    })

    await expect(fetchAllWorkflows('https://n8n.example.com', 'key', fetchImpl, AbortSignal.abort()))
      .rejects.toThrow()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('throws an invalid-key error on 401', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(401, {}))
    await expect(fetchAllWorkflows('https://h', 'bad', fetchImpl))
      .rejects.toMatchObject({ kind: 'invalid_key', statusCode: 401 })
  })

  it('throws not-n8n when a 200 response lacks a data array', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(200, { something: 'else' }))
    await expect(fetchAllWorkflows('https://h', 'key', fetchImpl))
      .rejects.toMatchObject({ kind: 'not_n8n' })
  })
})

describe('fetchAllCredentials (best-effort)', () => {
  it('paginates and returns items on 200', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(resp(200, { data: [{ id: '1', name: 'A', type: 'githubApi' }], nextCursor: 'c2' }))
      .mockResolvedValueOnce(resp(200, { data: [{ id: '2', name: 'B', type: 'slackApi' }], nextCursor: null }))
    const got = await fetchAllCredentials('https://n8n.example.com', 'key', fetchImpl)
    expect(got?.map(c => c.id)).toEqual(['1', '2'])
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/v1/credentials')
  })

  it('returns null on 403 (missing scope)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(403, {}))
    expect(await fetchAllCredentials('https://h', 'key', fetchImpl)).toBeNull()
  })

  it('returns null on 404 (endpoint absent)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(404, {}))
    expect(await fetchAllCredentials('https://h', 'key', fetchImpl)).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'))
    expect(await fetchAllCredentials('https://h', 'key', fetchImpl)).toBeNull()
  })
})

describe('fetchAllDataTables (best-effort)', () => {
  it('returns items on 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(200, {
      data: [{ id: 't1', name: 'Demo', projectId: 'p', columns: [{ id: 'c', name: 'name', type: 'string', index: 0 }] }],
      nextCursor: null,
    }))
    const got = await fetchAllDataTables('https://h', 'key', fetchImpl)
    expect(got?.[0]).toMatchObject({ id: 't1', name: 'Demo' })
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/v1/data-tables')
  })

  it('returns null on 403', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(403, {}))
    expect(await fetchAllDataTables('https://h', 'key', fetchImpl)).toBeNull()
  })
})
