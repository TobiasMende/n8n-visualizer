import type { RawWorkflow } from '#shared/types/graph'
import { stripTrailingSlash } from '#shared/url'

interface ListResponse { data: RawWorkflow[]; nextCursor?: string | null }

const PAGE_CAP = 200

export async function fetchAllWorkflows(baseUrl: string, apiKey: string): Promise<RawWorkflow[]> {
  const base = stripTrailingSlash(baseUrl)
  const all: RawWorkflow[] = []
  let cursor: string | undefined
  let page = 0

  do {
    const url = new URL(`${base}/api/v1/workflows`)
    url.searchParams.set('limit', '250')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url, {
      headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`n8n API request failed: ${res.status}`)

    const body = (await res.json()) as ListResponse
    all.push(...(body.data ?? []))
    cursor = body.nextCursor ?? undefined
    page++
    if (page >= PAGE_CAP) break
  } while (cursor)

  return all
}
