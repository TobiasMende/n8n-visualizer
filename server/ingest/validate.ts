import type { SafeFetchError } from './safe-fetch'

export type IngestErrorKind =
  | 'bad_url'
  | 'blocked'
  | 'unreachable'
  | 'too_large'
  | 'invalid_key'
  | 'not_n8n'

export class IngestError extends Error {
  constructor(public kind: IngestErrorKind, public statusCode: number, message: string) {
    super(message)
    this.name = 'IngestError'
  }
}

// Maps a low-level SSRF-guard failure to a user-facing ingest error. Never
// includes the API key or raw host internals.
export function ingestErrorFromSafeFetch(e: SafeFetchError): IngestError {
  switch (e.kind) {
    case 'invalid_url':
      return new IngestError('bad_url', 400, 'baseUrl must be a valid http(s) URL')
    case 'blocked':
      return new IngestError('blocked', 400, 'That host is not allowed (private or internal address)')
    case 'too_large':
      return new IngestError('too_large', 502, 'The n8n instance returned an unexpectedly large response')
    case 'too_many_redirects':
      return new IngestError('unreachable', 502, 'The n8n instance redirected too many times')
    case 'unreachable':
    default:
      return new IngestError('unreachable', 502, 'Could not reach that host')
  }
}

// Classifies the n8n workflows-list response so the user gets an honest reason.
export function assertN8nListResponse(status: number, body: unknown): void {
  if (status === 401 || status === 403)
    throw new IngestError('invalid_key', 401, 'Invalid n8n API key')

  if (status >= 200 && status < 300) {
    if (body && typeof body === 'object' && Array.isArray((body as any).data)) return
    throw new IngestError('not_n8n', 502, 'That URL did not respond like an n8n public API')
  }

  throw new IngestError('not_n8n', 502, `That URL did not respond like an n8n public API (HTTP ${status})`)
}
