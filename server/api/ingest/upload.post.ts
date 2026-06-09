import { normalizeWorkflows } from '../../ingest/normalize'
import { buildGraph } from '../../parser/build-graph'
import { buildCatalog } from '../../catalog/catalog'
import bundled from '../../catalog/bundled.json'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const raw = body?.workflows ?? body
    const baseUrl = typeof body?.baseUrl === 'string' && body.baseUrl ? body.baseUrl : null
    const workflows = normalizeWorkflows(raw)
    const catalog = await buildCatalog({
      host: null, cache: { get: async () => null, set: async () => {} }, source: { fetch: async () => null }, bundled,
    })
    return buildGraph(workflows, baseUrl, { from: new Date().toISOString(), catalog })
  } catch (e: any) {
    if (e?.statusCode) throw e
    throw createError({ statusCode: 400, statusMessage: 'Invalid request body' })
  }
})
