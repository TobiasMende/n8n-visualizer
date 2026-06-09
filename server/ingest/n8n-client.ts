import type { RawWorkflow } from '#shared/types/graph'
import { stripTrailingSlash } from '#shared/url'
import { safeFetch, type SafeResponse } from './safe-fetch'
import { assertN8nListResponse } from './validate'

export type FetchImpl = typeof safeFetch

interface ListResponse { data: RawWorkflow[]; nextCursor?: string | null }

const PAGE_CAP = 200
const PAGE_SIZE = 100
// n8n workflow JSON can be large; a full page of complex workflows easily
// exceeds safe-fetch's default 10 MB cap. Raise it for this trusted endpoint.
const WORKFLOWS_MAX_RESPONSE_BYTES = 50 * 1024 * 1024 // 50 MB
// One deadline for the whole pagination, not per page — otherwise a malicious
// host can stall ~15s on every page and tie a request up for PAGE_CAP × 15s.
const TOTAL_DEADLINE_MS = 30_000

export async function fetchAllWorkflows(
  baseUrl: string,
  apiKey: string,
  fetchImpl: FetchImpl = safeFetch,
  deadline: AbortSignal = AbortSignal.timeout(TOTAL_DEADLINE_MS),
): Promise<RawWorkflow[]> {
  const base = stripTrailingSlash(baseUrl)
  const all: RawWorkflow[] = []
  let cursor: string | undefined
  let page = 0

  do {
    deadline.throwIfAborted()

    const url = new URL(`${base}/api/v1/workflows`)
    url.searchParams.set('limit', String(PAGE_SIZE))
    if (cursor) url.searchParams.set('cursor', cursor)

    const res: SafeResponse = await fetchImpl(url.toString(), {
      headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' },
      signal: deadline,
      maxResponseBytes: WORKFLOWS_MAX_RESPONSE_BYTES,
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
