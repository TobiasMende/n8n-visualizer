import { fetchAllWorkflows, fetchAllCredentials, fetchAllDataTables } from '../../ingest/n8n-client'
import { buildGraph } from '../../parser/build-graph'
import { buildCatalog } from '../../catalog/catalog'
import { diskCatalogCache } from '../../catalog/disk-cache'
import { instanceCatalogSource } from '../../catalog/instance-source'
import { ingestErrorFromSafeFetch } from '../../ingest/validate'
import { readJsonBodyCapped } from '../../util/body'
import bundled from '../../catalog/bundled.json'

const MAX_BODY_BYTES = 64 * 1024 // 64 KB — this endpoint only needs a small JSON object

export default defineEventHandler(async (event) => {
  const { baseUrl, apiKey } = (await readJsonBodyCapped(event, MAX_BODY_BYTES)) ?? {}
  if (!baseUrl || !apiKey)
    throw createError({ statusCode: 400, statusMessage: 'baseUrl and apiKey are required' })

  let host: string
  try {
    const u = new URL(baseUrl)
    if (!/^https?:$/.test(u.protocol)) throw 0
    host = u.host
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'baseUrl must be a valid http(s) URL' })
  }

  try {
    const workflows = await fetchAllWorkflows(baseUrl, apiKey)
    const [catalog, apiCredentials, apiDataTables] = await Promise.all([
      buildCatalog({
        host, cache: diskCatalogCache(), source: instanceCatalogSource(baseUrl, apiKey), bundled,
      }),
      fetchAllCredentials(baseUrl, apiKey),
      fetchAllDataTables(baseUrl, apiKey),
    ])
    return buildGraph(workflows, baseUrl, {
      from: new Date().toISOString(), catalog, apiCredentials, apiDataTables,
    })
  } catch (e: any) {
    // Match by name, not instanceof: the production bundle can split these
    // classes across chunks, breaking cross-module instanceof checks.
    const ingest = e?.name === 'SafeFetchError' ? ingestErrorFromSafeFetch(e) : e
    if (ingest?.name === 'IngestError' && typeof ingest.statusCode === 'number')
      throw createError({ statusCode: ingest.statusCode, statusMessage: ingest.message })
    if (e?.statusCode) throw e
    throw createError({ statusCode: 502, statusMessage: 'n8n fetch failed' })
  }
})
