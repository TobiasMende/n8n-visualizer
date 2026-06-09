import { normalizeWorkflows } from '../../ingest/normalize'
import { buildGraph } from '../../parser/build-graph'
import { buildCatalog } from '../../catalog/catalog'
import { isHttpUrl } from '#shared/url'
import { readJsonBodyCapped } from '../../util/body'
import bundled from '../../catalog/bundled.json'

const MAX_BODY_BYTES = 5 * 1024 * 1024 // 5 MB

export default defineEventHandler(async (event) => {
  const body = await readJsonBodyCapped(event, MAX_BODY_BYTES)
  try {
    const raw = body?.workflows ?? body
    // Only keep a baseUrl that is a real http(s) URL — it flows into deep-link
    // and webhook hrefs, so a javascript:/data: value would be a stored-XSS vector.
    const baseUrl = isHttpUrl(body?.baseUrl) ? body.baseUrl : null
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
