import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchAllWorkflows } from './n8n-client'

afterEach(() => vi.restoreAllMocks())

describe('fetchAllWorkflows', () => {
  it('follows nextCursor pagination and concatenates pages', async () => {
    const pages = [
      { data: [{ id: 'a', name: 'A', nodes: [] }], nextCursor: 'cur2' },
      { data: [{ id: 'b', name: 'B', nodes: [] }], nextCursor: null },
    ]
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => pages[0] })
      .mockResolvedValueOnce({ ok: true, json: async () => pages[1] })
    vi.stubGlobal('fetch', fetchMock)

    const got = await fetchAllWorkflows('https://n8n.example.com', 'key')
    expect(got.map(w => w.id)).toEqual(['a', 'b'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstUrl = fetchMock.mock.calls[0][0].toString()
    expect(firstUrl).toContain('/api/v1/workflows')
  })

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(fetchAllWorkflows('https://h', 'bad')).rejects.toThrow('401')
  })
})
