import type { RawWorkflow } from '#shared/types/graph'

interface ListResponse { data: RawWorkflow[]; nextCursor?: string | null }

export async function fetchAllWorkflows(baseUrl: string, apiKey: string): Promise<RawWorkflow[]> {
  const base = baseUrl.replace(/\/+$/, '')
  const all: RawWorkflow[] = []
  let cursor: string | undefined

  do {
    const url = new URL(`${base}/api/v1/workflows`)
    url.searchParams.set('limit', '250')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url, { headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' } })
    if (!res.ok) throw new Error(`n8n API request failed: ${res.status}`)

    const body = (await res.json()) as ListResponse
    all.push(...(body.data ?? []))
    cursor = body.nextCursor ?? undefined
  } while (cursor)

  return all
}
