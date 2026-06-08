import { fetchAllWorkflows } from '../../ingest/n8n-client'
import { buildGraph } from '../../parser/build-graph'

export default defineEventHandler(async (event) => {
  const { baseUrl, apiKey } = await readBody(event)
  if (!baseUrl || !apiKey)
    throw createError({ statusCode: 400, statusMessage: 'baseUrl and apiKey are required' })

  try {
    const workflows = await fetchAllWorkflows(baseUrl, apiKey)
    return buildGraph(workflows, baseUrl)
  } catch (e: any) {
    throw createError({ statusCode: 502, statusMessage: e?.message ?? 'n8n fetch failed' })
  }
})
