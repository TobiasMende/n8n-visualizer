export interface SessionData { baseUrl: string; apiKey: string }

// Body creds (the no-remember path) win when complete; otherwise fall back to
// the sealed session cookie (remember path); null means "not connected" -> 401.
export function resolveIngestCreds(
  body: { baseUrl?: unknown; apiKey?: unknown } | null | undefined,
  session: SessionData | null,
): SessionData | null {
  if (body && typeof body.baseUrl === 'string' && typeof body.apiKey === 'string')
    return { baseUrl: body.baseUrl, apiKey: body.apiKey }
  return session ?? null
}
