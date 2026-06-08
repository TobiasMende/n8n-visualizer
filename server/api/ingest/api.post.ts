import { fetchAllWorkflows } from '../../ingest/n8n-client'
import { buildGraph } from '../../parser/build-graph'
import { buildCatalog } from '../../catalog/catalog'
import { diskCatalogCache } from '../../catalog/disk-cache'
import { instanceCatalogSource } from '../../catalog/instance-source'
import bundled from '../../catalog/bundled.json'

export default defineEventHandler(async (event) => {
  const { baseUrl, apiKey } = await readBody(event)
  if (!baseUrl || !apiKey)
    throw createError({ statusCode: 400, statusMessage: 'baseUrl and apiKey are required' })
  try {
    const workflows = await fetchAllWorkflows(baseUrl, apiKey)
    const host = new URL(baseUrl).host
    const catalog = await buildCatalog({
      host, cache: diskCatalogCache(), source: instanceCatalogSource(baseUrl, apiKey), bundled,
    })
    return buildGraph(workflows, baseUrl, { from: new Date().toISOString(), catalog })
  } catch (e: any) {
    throw createError({ statusCode: 502, statusMessage: e?.message ?? 'n8n fetch failed' })
  }
})
