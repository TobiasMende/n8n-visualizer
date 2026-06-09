import { useRuntimeConfig } from '#imports'
import type { H3Event } from 'h3'

// Returns a usable sealing password, or null when none is configured (e.g.
// production with NUXT_SESSION_PASSWORD unset). Callers degrade to the
// no-remember body path when this is null.
export function resolveSessionPassword(event: H3Event): string | null {
  const pw = useRuntimeConfig(event).sessionPassword
  return typeof pw === 'string' && pw.length >= 32 ? pw : null
}
