import { describe, it, expect, vi } from 'vitest'
import { fetchAllWorkflows } from './n8n-client'
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
