import { normalizeWorkflows } from '../../ingest/normalize'
import { buildGraph } from '../../parser/build-graph'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const raw = body?.workflows ?? body
  const baseUrl = typeof body?.baseUrl === 'string' && body.baseUrl ? body.baseUrl : null
  const workflows = normalizeWorkflows(raw)
  return buildGraph(workflows, baseUrl)
})
