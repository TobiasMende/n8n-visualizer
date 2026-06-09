import { readJsonBodyCapped } from '../util/body'
import { isHttpUrl, hostOf } from '#shared/url'
import { sessionConfig, writeSession } from '../session/store'
import { resolveSessionPassword } from '../session/password'

const MAX_BODY_BYTES = 64 * 1024

export default defineEventHandler(async (event) => {
  const password = resolveSessionPassword(event)
  if (!password)
    throw createError({ statusCode: 500, statusMessage: 'Remember-me is not configured on this server' })

  const { baseUrl, apiKey } = (await readJsonBodyCapped(event, MAX_BODY_BYTES)) ?? {}
  if (typeof baseUrl !== 'string' || typeof apiKey !== 'string' || !baseUrl || !apiKey)
    throw createError({ statusCode: 400, statusMessage: 'baseUrl and apiKey are required' })
  if (!isHttpUrl(baseUrl))
    throw createError({ statusCode: 400, statusMessage: 'baseUrl must be a valid http(s) URL' })

  await writeSession(event, sessionConfig(password, import.meta.dev), { baseUrl, apiKey })
  return { host: hostOf(baseUrl) }
})
