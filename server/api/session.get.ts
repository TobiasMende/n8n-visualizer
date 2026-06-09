import { hostOf } from '#shared/url'
import { sessionConfig, readSession } from '../session/store'
import { resolveSessionPassword } from '../session/password'

export default defineEventHandler(async (event) => {
  const password = resolveSessionPassword(event)
  if (!password) return { connected: false }
  const data = await readSession(event, sessionConfig(password, import.meta.dev))
  return data ? { connected: true, host: hostOf(data.baseUrl) } : { connected: false }
})
