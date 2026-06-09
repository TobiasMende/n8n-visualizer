# httpOnly session for the n8n API key + remember toggle

**Date:** 2026-06-09
**Status:** Approved (design)

## Problem

The n8n API key is stored in `sessionStorage` (`useConnectionStorage.ts`) as
plaintext JSON and re-sent in every `/api/ingest/api` body. Any successful XSS on
the origin can read it out of web storage and exfiltrate it for offline reuse.
The key is read-only (`Workflow: List/Read`), and the CSP is tight, but web
storage offers zero defense-in-depth for a secret.

## Goals

- Stop storing the key in JS-readable web storage.
- Default to **no key at rest anywhere** (in-memory, single-use).
- Offer an opt-in "remember" mode that survives reload without exposing the raw
  key to JavaScript (httpOnly cookie).
- Keep the existing server-proxy model: the browser only talks to our origin.
- Persist nothing instance-derived to disk server-side (already true; keep it).

## Non-goals

- Server-side session storage (Redis/KV). The sealed cookie *is* the store —
  stateless, fits Vercel serverless.
- Multi-user accounts / login. This is a single-connection visualizer.

## Decisions

- **Toggle default: OFF (in-memory).** User opts in to remembering.
- **Cookie lifetime when ON: 7 days** (fixed `maxAge`).
- Cookie sealed via h3 `useSession` (iron-sealed, encrypted, httpOnly).

## Architecture

Server-proxy model unchanged. The key reaches the server one of two ways:

- **Remember OFF (default):** key sent in the `POST /api/ingest/api` body, used
  for that single request, never stored. Reload requires re-entering baseUrl +
  key. No key at rest, client- or server-side.
- **Remember ON:** key sealed into an httpOnly cookie by `POST /api/session`.
  Subsequent ingest reads creds from the cookie. JS never sees the key again
  after the initial submit.

### Endpoints

| Route | Purpose |
|---|---|
| `POST /api/session` | Validate `{baseUrl, apiKey}`, seal into the session cookie. Returns `{host}`. ON path only. |
| `GET /api/session` | Return `{connected: boolean, host?: string}` read from the cookie. **Never returns the key.** Used by `restoreConnection` on page load. |
| `DELETE /api/session` | Clear the session cookie. |
| `POST /api/ingest/api` | Modified credential source: **body if present (OFF) → else cookie (ON) → else 401**. |

`POST /api/ingest/upload` is unchanged (no key involved).

### Cookie / session config

```ts
const sessionConfig = {
  password: runtimeConfig.sessionPassword,
  name: 'n8nviz_sess',
  cookie: {
    httpOnly: true,
    secure: !import.meta.dev,   // TLS-only in prod
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 * 7,   // 7 days
  },
}
```

Stored session data: `{ baseUrl: string, apiKey: string }`. Nothing else.

## CSRF

The cookie makes auth ambient, which introduces CSRF risk that the current
body-only model does not have. Two layers:

1. `sameSite: 'strict'` on the session cookie — browsers do not attach it to
   cross-site requests.
2. An Origin/Referer check (server middleware) on all state-changing `/api/*`
   requests (`POST`/`DELETE`). Reject when an `Origin` header is present and its
   origin does not equal the request's own origin. Requests with no `Origin`
   (same-origin GET, non-browser clients) are allowed through; the cookie's
   SameSite still protects the cookie path.

Pure helper `isSameOrigin(event): boolean` so the rule is unit-testable.

## Secret management

- `runtimeConfig.sessionPassword` populated from `NUXT_SESSION_PASSWORD`
  (must be ≥ 32 chars for iron sealing).
- **Local dev:** a built-in dev-only default constant so the app runs without
  setup. Never used when `NUXT_SESSION_PASSWORD` is set.
- **Production with the secret unset:** `POST /api/session` returns a clear
  `500` ("Remember-me is not configured on this server"). The app **degrades
  gracefully**: the OFF/in-memory path needs no secret and keeps working, so the
  visualizer is fully usable without remember-me. `GET /api/session` returns
  `{connected: false}` in that case.
- README documents the env var; add it to the Vercel project.

## Client / store changes

`app/stores/graph.ts`:

- `loadFromApi(baseUrl, apiKey, remember: boolean)`:
  - `remember` → `POST /api/session {baseUrl, apiKey}`, then `POST /api/ingest/api {}` (cookie path).
  - else → `POST /api/ingest/api {baseUrl, apiKey}` (body path, nothing stored).
- `restoreConnection()` → `GET /api/session`; if `connected`, set host and load
  the graph via `POST /api/ingest/api {}`. No web storage read.
- `disconnect()` → `DELETE /api/session`, then clear state.
- Connection state shrinks to `{ connected: boolean, host: string | null }` —
  the store no longer holds `apiKey` at all. `connectedHost` derives from the
  server response.

`app/components/Toolbar.vue`:

- Add an unchecked checkbox: "Remember on this device (7 days)".
- Pass its value as `remember` to `loadFromApi`.
- Replace the "API key stored for this browser session only" hint with copy that
  reflects the new behavior (in-memory by default; encrypted httpOnly cookie when
  remembered).

### Removed

- `app/composables/useConnectionStorage.ts` and `useConnectionStorage.test.ts` —
  the key is no longer placed in web storage. `hostOf` (the one still-useful
  helper) moves to wherever the store needs it, or is inlined.

## Rate limiting

Add `POST /api/session` to `LIMITED_PATHS` in `server/ratelimit/config.ts`
alongside the existing ingest routes, to bound key-submission abuse. Limiter
behavior otherwise unchanged.

## Testing

- `resolveIngestCreds(body, sessionData)` — pure helper returning the chosen
  `{baseUrl, apiKey}` or null. Unit-test precedence: body wins, else cookie,
  else null (→ 401).
- `isSameOrigin(event)` — pure helper. Unit-test: same-origin allowed,
  cross-origin rejected, missing Origin allowed.
- Seal/unseal round-trip via `sealSession`/`unsealSession` (or `useSession`) to
  confirm the cookie carries the data and is opaque.
- Existing ingest/parser/ratelimit tests remain green.

## Edge cases

- Cookie present but unseal fails (rotated password, tampering) → treat as not
  connected (`GET /api/session` → `{connected: false}`); ingest cookie path →
  401.
- `disconnect()` when no cookie exists → no-op, still clears client state.
- Body path with partial creds (only baseUrl, or only apiKey) → falls through to
  the cookie session; if there is none, ingest returns `401` (not connected).
- Re-running `POST /api/session` on a still-valid cookie preserves the original
  7-day expiry rather than extending it (h3 reuses the session `createdAt`). This
  errs toward a shorter lifetime, which is acceptable.
- Remember path where `POST /api/session` succeeds but the follow-up ingest fails
  leaves a sealed cookie with the client showing disconnected; the next reload
  (`restoreConnection`) recovers the connection from the cookie.

## Security properties (summary)

- **OFF (default):** key in browser JS memory for a single request, then gone.
  Nothing at rest anywhere.
- **ON:** key encrypted, httpOnly, `SameSite=Strict`, `Secure`, 7-day cookie.
  XSS can still *use* the live session (call ingest, read the returned graph) but
  **cannot read the raw key**; CSRF blocked by SameSite + Origin check.
- Server persists nothing to disk; it only holds the sealing password (env).
