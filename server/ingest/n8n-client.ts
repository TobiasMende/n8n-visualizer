import type { RawWorkflow } from '#shared/types/graph'
import { stripTrailingSlash } from '#shared/url'
import { safeFetch, type SafeResponse } from './safe-fetch'
import { assertN8nListResponse } from './validate'

export type FetchImpl = typeof safeFetch

interface ListResponse { data: RawWorkflow[]; nextCursor?: string | null }

const PAGE_CAP = 200

export async function fetchAllWorkflows(
  baseUrl: string,
  apiKey: string,
  fetchImpl: FetchImpl = safeFetch,
): Promise<RawWorkflow[]> {
  const base = stripTrailingSlash(baseUrl)
  const all: RawWorkflow[] = []
  let cursor: string | undefined
  let page = 0

  do {
    const url = new URL(`${base}/api/v1/workflows`)
    url.searchParams.set('limit', '250')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res: SafeResponse = await fetchImpl(url.toString(), {
      headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' },
      signal: AbortSignal.timeout(15000),
    })

    let body: ListResponse | null = null
    try {
      body = (await res.json()) as ListResponse
    } catch (e: any) {
      if (e?.name === 'SafeFetchError') throw e
      body = null
    }
    assertN8nListResponse(res.status, body)

    all.push(...(body!.data ?? []))
    cursor = body!.nextCursor ?? undefined
    page++
    if (page >= PAGE_CAP) break
  } while (cursor)

  return all
}
