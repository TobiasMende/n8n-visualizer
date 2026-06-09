import { sessionConfig, destroySession } from '../session/store'
import { resolveSessionPassword } from '../session/password'

export default defineEventHandler(async (event) => {
  const password = resolveSessionPassword(event)
  if (password) await destroySession(event, sessionConfig(password, import.meta.dev))
  return { ok: true }
})
