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
    url.searchParams.set('excludePinnedData', 'true')
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

    // Archived workflows are inactive — no live webhooks/triggers. Drop them.
    all.push(...(body!.data ?? []).filter(w => !w.isArchived))
    cursor = body!.nextCursor ?? undefined
    page++
    if (page >= PAGE_CAP) break
  } while (cursor)

  return all
}

export interface ApiCredential {
  id: string; name: string; type: string
  createdAt?: string; updatedAt?: string
}
export interface ApiDataTableColumn { id: string; name: string; type: string; index: number }
export interface ApiDataTable {
  id: string; name: string; projectId?: string | null
  columns?: ApiDataTableColumn[]; createdAt?: string; updatedAt?: string
}

// Enrichment endpoints are optional: a key lacking the list scope returns 403,
// an older n8n returns 404. Neither should fail ingest, so this paginator
// resolves to null on any non-2xx, malformed body, or fetch error.
async function fetchListBestEffort<T>(
  baseUrl: string, apiKey: string, path: string,
  fetchImpl: FetchImpl = safeFetch,
  deadline: AbortSignal = AbortSignal.timeout(TOTAL_DEADLINE_MS),
): Promise<T[] | null> {
  const base = stripTrailingSlash(baseUrl)
  const all: T[] = []
  let cursor: string | undefined
  let page = 0
  try {
    do {
      deadline.throwIfAborted()
      const url = new URL(`${base}${path}`)
      url.searchParams.set('limit', String(PAGE_SIZE))
      if (cursor) url.searchParams.set('cursor', cursor)
      const res = await fetchImpl(url.toString(), {
        headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' },
        signal: deadline,
      })
      if (res.status < 200 || res.status >= 300) return null
      let body: { data?: T[]; nextCursor?: string | null } | null = null
      try { body = (await res.json()) as typeof body } catch { return null }
      if (!body || !Array.isArray(body.data)) return null
      all.push(...body.data)
      cursor = body.nextCursor ?? undefined
      page++
      if (page >= PAGE_CAP) break
    } while (cursor)
    return all
  } catch {
    return null
  }
}

export function fetchAllCredentials(
  baseUrl: string, apiKey: string, fetchImpl: FetchImpl = safeFetch,
): Promise<ApiCredential[] | null> {
  return fetchListBestEffort<ApiCredential>(baseUrl, apiKey, '/api/v1/credentials', fetchImpl)
}

export function fetchAllDataTables(
  baseUrl: string, apiKey: string, fetchImpl: FetchImpl = safeFetch,
): Promise<ApiDataTable[] | null> {
  return fetchListBestEffort<ApiDataTable>(baseUrl, apiKey, '/api/v1/data-tables', fetchImpl)
}
