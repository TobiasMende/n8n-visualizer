# httpOnly Session Key + Remember Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop storing the n8n API key in JS-readable web storage; default to in-memory single-use, with an opt-in "remember" mode that seals the key into an httpOnly cookie.

**Architecture:** Server-proxy model unchanged. Credentials reach `/api/ingest/api` either in the request body (default, nothing stored) or from a sealed httpOnly cookie set via `POST /api/session` (remember mode). Security-critical logic (credential precedence, same-origin check, cookie config) lives in pure, unit-tested helpers; route handlers and the Pinia store are thin wiring verified by lint + the helper tests.

**Tech Stack:** Nuxt 4 / Nitro / h3 (`useSession`, `sealSession`, `unsealSession`), Vue 3 + Pinia, Vitest (happy-dom), bun.

---

## File Structure

**Create:**
- `server/session/origin.ts` — `originsMatch` (pure) + `isSameOrigin(event)` wrapper.
- `server/session/origin.test.ts`
- `server/session/creds.ts` — `resolveIngestCreds(body, session)` precedence helper + `SessionData` type.
- `server/session/creds.test.ts`
- `server/session/store.ts` — `sessionConfig(password, dev)`, `readSession`, `writeSession`, `destroySession`.
- `server/session/store.test.ts` — covers `sessionConfig` flags only.
- `server/middleware/csrf.ts` — rejects cross-origin state-changing `/api/*` requests.
- `server/api/session.post.ts`, `server/api/session.get.ts`, `server/api/session.delete.ts`

**Modify:**
- `shared/url.ts` (+ `shared/url.test.ts`) — add `hostOf`.
- `nuxt.config.ts` — add `runtimeConfig.sessionPassword`.
- `server/api/ingest/api.post.ts` — source creds from body-or-session.
- `server/ratelimit/config.ts` (+ `server/ratelimit/config.test.ts`) — add `/api/session` to limited paths.
- `app/stores/graph.ts` — `remember` flag, session-based restore/disconnect, drop `apiKey` from state.
- `app/components/Toolbar.vue` — "remember" checkbox + hint copy.
- `README.md` — document `NUXT_SESSION_PASSWORD`.

**Delete:**
- `app/composables/useConnectionStorage.ts`
- `app/composables/useConnectionStorage.test.ts`

---

## Task 1: Same-origin helper

**Files:**
- Create: `server/session/origin.ts`
- Test: `server/session/origin.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { originsMatch } from './origin'

describe('originsMatch', () => {
  it('allows a missing Origin header (non-browser / same-origin nav)', () => {
    expect(originsMatch(undefined, 'https://app.example.com')).toBe(true)
    expect(originsMatch('', 'https://app.example.com')).toBe(true)
  })
  it('allows an exact same-origin match', () => {
    expect(originsMatch('https://app.example.com', 'https://app.example.com')).toBe(true)
  })
  it('rejects a different origin', () => {
    expect(originsMatch('https://evil.example.com', 'https://app.example.com')).toBe(false)
    expect(originsMatch('http://app.example.com', 'https://app.example.com')).toBe(false)
  })
  it('rejects an unparseable Origin', () => {
    expect(originsMatch('not-a-url', 'https://app.example.com')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run server/session/origin.test.ts`
Expected: FAIL — `originsMatch` not exported / module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
import { getRequestHeader, getRequestURL, type H3Event } from 'h3'

// A missing Origin is allowed: non-browser clients and same-origin top-level
// GETs send none, and the session cookie's SameSite=Strict already guards the
// cookie path. A present Origin must exactly match the request's own origin.
export function originsMatch(origin: string | undefined, requestOrigin: string): boolean {
  if (!origin) return true
  try { return new URL(origin).origin === requestOrigin } catch { return false }
}

export function isSameOrigin(event: H3Event): boolean {
  return originsMatch(getRequestHeader(event, 'origin'), getRequestURL(event).origin)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run server/session/origin.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/session/origin.ts server/session/origin.test.ts
git commit -m "feat(session): same-origin check helper for CSRF protection"
```

---

## Task 2: CSRF middleware

**Files:**
- Create: `server/middleware/csrf.ts`

No new unit test (pure logic already covered in Task 1; middleware is thin wiring, consistent with `server/middleware/ratelimit.ts` having no direct test).

- [ ] **Step 1: Write the middleware**

```ts
import { isSameOrigin } from '../session/origin'

// Runs before ratelimit (alphabetical Nitro order: csrf < ratelimit). Blocks
// cross-origin state-changing calls so the ambient session cookie cannot be
// abused by another site. Read-only methods and non-API routes pass through.
export default defineEventHandler((event) => {
  const method = getMethod(event)
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return
  if (!getRequestURL(event).pathname.startsWith('/api/')) return
  if (!isSameOrigin(event))
    throw createError({ statusCode: 403, statusMessage: 'Cross-origin request blocked' })
})
```

- [ ] **Step 2: Verify the project still builds/lints**

Run: `bun run lint`
Expected: 0 errors (pre-existing `any` warnings only).

- [ ] **Step 3: Commit**

```bash
git add server/middleware/csrf.ts
git commit -m "feat(session): block cross-origin state-changing API requests"
```

---

## Task 3: Credential precedence helper

**Files:**
- Create: `server/session/creds.ts`
- Test: `server/session/creds.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { resolveIngestCreds } from './creds'

describe('resolveIngestCreds', () => {
  const session = { baseUrl: 'https://s', apiKey: 'sk' }
  it('prefers complete body creds over the session', () => {
    expect(resolveIngestCreds({ baseUrl: 'https://b', apiKey: 'bk' }, session))
      .toEqual({ baseUrl: 'https://b', apiKey: 'bk' })
  })
  it('falls back to the session when the body lacks creds', () => {
    expect(resolveIngestCreds({}, session)).toEqual(session)
    expect(resolveIngestCreds(null, session)).toEqual(session)
    expect(resolveIngestCreds({ baseUrl: 'https://b' }, session)).toEqual(session)
  })
  it('returns null when neither has complete creds', () => {
    expect(resolveIngestCreds({ baseUrl: 'https://b' }, null)).toBeNull()
    expect(resolveIngestCreds(null, null)).toBeNull()
  })
  it('ignores non-string body fields', () => {
    expect(resolveIngestCreds({ baseUrl: 1, apiKey: 2 } as any, session)).toEqual(session)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run server/session/creds.test.ts`
Expected: FAIL — module/function missing.

- [ ] **Step 3: Write minimal implementation**

```ts
export interface SessionData { baseUrl: string; apiKey: string }

// Body creds (the no-remember path) win when complete; otherwise fall back to
// the sealed session cookie (remember path); null means "not connected" → 401.
export function resolveIngestCreds(
  body: { baseUrl?: unknown; apiKey?: unknown } | null | undefined,
  session: SessionData | null,
): SessionData | null {
  if (body && typeof body.baseUrl === 'string' && typeof body.apiKey === 'string')
    return { baseUrl: body.baseUrl, apiKey: body.apiKey }
  return session ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run server/session/creds.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/session/creds.ts server/session/creds.test.ts
git commit -m "feat(session): credential precedence helper (body over cookie)"
```

---

## Task 4: Session store module

**Files:**
- Create: `server/session/store.ts`
- Test: `server/session/store.test.ts`

- [ ] **Step 1: Write the failing test (config flags only)**

```ts
import { describe, it, expect } from 'vitest'
import { sessionConfig } from './store'

describe('sessionConfig', () => {
  it('produces a hardened 7-day cookie in production', () => {
    const c = sessionConfig('x'.repeat(32), false)
    expect(c.name).toBe('n8nviz_sess')
    expect(c.password).toHaveLength(32)
    expect(c.cookie).toMatchObject({
      httpOnly: true, secure: true, sameSite: 'strict', maxAge: 60 * 60 * 24 * 7,
    })
  })
  it('drops the Secure flag in dev (no TLS on localhost)', () => {
    expect(sessionConfig('x'.repeat(32), true).cookie.secure).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run server/session/store.test.ts`
Expected: FAIL — module/function missing.

- [ ] **Step 3: Write the implementation**

```ts
import { getCookie, unsealSession, useSession, clearSession, type H3Event } from 'h3'
import type { SessionData } from './creds'

const COOKIE_NAME = 'n8nviz_sess'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface SessionConfig {
  password: string
  name: string
  cookie: { httpOnly: true; secure: boolean; sameSite: 'strict'; maxAge: number }
}

export function sessionConfig(password: string, dev: boolean): SessionConfig {
  return {
    password,
    name: COOKIE_NAME,
    cookie: { httpOnly: true, secure: !dev, sameSite: 'strict', maxAge: MAX_AGE },
  }
}

// Read without side effects: never sets a cookie just to check status.
export async function readSession(event: H3Event, config: SessionConfig): Promise<SessionData | null> {
  const sealed = getCookie(event, config.name)
  if (!sealed) return null
  try {
    const { data } = await unsealSession(event, config, sealed)
    return data && typeof data.baseUrl === 'string' && typeof data.apiKey === 'string'
      ? { baseUrl: data.baseUrl, apiKey: data.apiKey }
      : null
  } catch {
    return null // rotated password / tampered cookie → treat as not connected
  }
}

export async function writeSession(event: H3Event, config: SessionConfig, data: SessionData): Promise<void> {
  const session = await useSession<SessionData>(event, config)
  await session.update(data)
}

export async function destroySession(event: H3Event, config: SessionConfig): Promise<void> {
  await clearSession(event, config)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run server/session/store.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/session/store.ts server/session/store.test.ts
git commit -m "feat(session): sealed httpOnly cookie store (read/write/destroy)"
```

---

## Task 5: runtimeConfig + password resolution

**Files:**
- Modify: `nuxt.config.ts`
- Modify: `server/session/store.ts` (add `resolveSessionPassword`)

- [ ] **Step 1: Add runtimeConfig to `nuxt.config.ts`**

Insert this key inside the `defineNuxtConfig({ ... })` object (e.g. right after `compatibilityDate`):

```ts
  runtimeConfig: {
    // Iron-sealing password for the remember-me session cookie. MUST be set
    // (>=32 chars) in production via NUXT_SESSION_PASSWORD. The dev-only default
    // keeps local runs working and is never used once the env var is set.
    sessionPassword:
      process.env.NUXT_SESSION_PASSWORD ||
      (process.env.NODE_ENV === 'production' ? '' : 'dev-only-insecure-session-password-change-me'),
  },
```

- [ ] **Step 2: Add the resolver to `server/session/store.ts`**

Append:

```ts
import { useRuntimeConfig } from '#imports'

// Returns a usable sealing password, or null when none is configured (e.g.
// production with NUXT_SESSION_PASSWORD unset). Callers degrade to the
// no-remember body path when this is null.
export function resolveSessionPassword(event: H3Event): string | null {
  const pw = useRuntimeConfig(event).sessionPassword
  return typeof pw === 'string' && pw.length >= 32 ? pw : null
}
```

- [ ] **Step 3: Verify build/lint**

Run: `bun run lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add nuxt.config.ts server/session/store.ts
git commit -m "feat(session): runtimeConfig sessionPassword + resolver with dev fallback"
```

---

## Task 6: `/api/session` routes

**Files:**
- Create: `server/api/session.post.ts`, `server/api/session.get.ts`, `server/api/session.delete.ts`

- [ ] **Step 1: Write `server/api/session.post.ts`**

```ts
import { readJsonBodyCapped } from '../util/body'
import { isHttpUrl, hostOf } from '#shared/url'
import { sessionConfig, writeSession, resolveSessionPassword } from '../session/store'

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
```

- [ ] **Step 2: Write `server/api/session.get.ts`**

```ts
import { hostOf } from '#shared/url'
import { sessionConfig, readSession, resolveSessionPassword } from '../session/store'

export default defineEventHandler(async (event) => {
  const password = resolveSessionPassword(event)
  if (!password) return { connected: false }
  const data = await readSession(event, sessionConfig(password, import.meta.dev))
  return data ? { connected: true, host: hostOf(data.baseUrl) } : { connected: false }
})
```

- [ ] **Step 3: Write `server/api/session.delete.ts`**

```ts
import { sessionConfig, destroySession, resolveSessionPassword } from '../session/store'

export default defineEventHandler(async (event) => {
  const password = resolveSessionPassword(event)
  if (password) await destroySession(event, sessionConfig(password, import.meta.dev))
  return { ok: true }
})
```

- [ ] **Step 4: Verify build/lint**

Run: `bun run lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add server/api/session.post.ts server/api/session.get.ts server/api/session.delete.ts
git commit -m "feat(session): /api/session connect, status, and clear routes"
```

---

## Task 7: Source ingest creds from body-or-session

**Files:**
- Modify: `server/api/ingest/api.post.ts`

- [ ] **Step 1: Update the handler**

Replace the body-reading + validation block at the top (current lines ~12–24, from `const { baseUrl, apiKey } = ...` through the `host` derivation `catch`) with:

```ts
  const body = (await readJsonBodyCapped(event, MAX_BODY_BYTES)) ?? {}
  const password = resolveSessionPassword(event)
  const session = password ? await readSession(event, sessionConfig(password, import.meta.dev)) : null
  const creds = resolveIngestCreds(body, session)
  if (!creds)
    throw createError({ statusCode: 401, statusMessage: 'Not connected — provide baseUrl and apiKey' })
  const { baseUrl, apiKey } = creds

  let host: string
  try {
    const u = new URL(baseUrl)
    if (!/^https?:$/.test(u.protocol)) throw 0
    host = u.host
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'baseUrl must be a valid http(s) URL' })
  }
```

Add these imports at the top of the file (the file already imports `readJsonBodyCapped` and `bundled`):

```ts
import { resolveIngestCreds } from '../../session/creds'
import { sessionConfig, readSession, resolveSessionPassword } from '../../session/store'
```

Leave the rest of the handler (the `try { fetchAllWorkflows ... }` block and error mapping) unchanged.

- [ ] **Step 2: Run the full server test suite**

Run: `bun run vitest run server/`
Expected: PASS (all existing server tests, including ingest, still green).

- [ ] **Step 3: Lint**

Run: `bun run lint`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add server/api/ingest/api.post.ts
git commit -m "feat(ingest): accept creds from request body or sealed session cookie"
```

---

## Task 8: Rate-limit the session connect route

**Files:**
- Modify: `server/ratelimit/config.ts:19`
- Modify: `server/ratelimit/config.test.ts`

- [ ] **Step 1: Add the failing test**

Append inside the existing `isLimitedPath` describe block in `server/ratelimit/config.test.ts`:

```ts
  it('limits the session connect route', () => {
    expect(isLimitedPath('/api/session')).toBe(true)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run server/ratelimit/config.test.ts`
Expected: FAIL — `/api/session` not in the set.

- [ ] **Step 3: Update the path set**

In `server/ratelimit/config.ts`, change:

```ts
const LIMITED_PATHS = new Set(['/api/ingest/api', '/api/ingest/upload'])
```

to:

```ts
const LIMITED_PATHS = new Set(['/api/ingest/api', '/api/ingest/upload', '/api/session'])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run server/ratelimit/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/ratelimit/config.ts server/ratelimit/config.test.ts
git commit -m "feat(ratelimit): rate-limit POST /api/session"
```

---

## Task 9: Move `hostOf` into shared/url

**Files:**
- Modify: `shared/url.ts`
- Modify: `shared/url.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `shared/url.test.ts`:

```ts
import { hostOf } from './url'

describe('hostOf', () => {
  it('extracts the host', () => {
    expect(hostOf('https://n8n.example.com/x')).toBe('n8n.example.com')
  })
  it('falls back to the raw string when not a URL', () => {
    expect(hostOf('not a url')).toBe('not a url')
  })
})
```

(If `shared/url.test.ts` already imports other symbols from `./url`, merge `hostOf` into the existing import instead of adding a duplicate import line.)

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run shared/url.test.ts`
Expected: FAIL — `hostOf` not exported.

- [ ] **Step 3: Add `hostOf` to `shared/url.ts`**

```ts
export function hostOf(baseUrl: string): string {
  try { return new URL(baseUrl).host } catch { return baseUrl }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run shared/url.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/url.ts shared/url.test.ts
git commit -m "refactor(url): add shared hostOf helper"
```

---

## Task 10: Rework the graph store

**Files:**
- Modify: `app/stores/graph.ts`

The store no longer holds the API key. `connection` becomes `{ host }` and connection state is tracked by a `connected` boolean.

- [ ] **Step 1: Replace the connection state + imports**

Change the imports at the top:

```ts
import { hostOf } from '#shared/url'
import { defaultVisibility, type Visibility } from '~/composables/useVisibility'
```

Replace the `connection` ref and `extractError`:

```ts
  const connected = ref(false)
  const connectedHost = ref<string | null>(null)

  function extractError(e: any): string {
    return e?.data?.statusMessage ?? e?.statusMessage ?? e?.message ?? 'Request failed'
  }
```

- [ ] **Step 2: Replace `loadFromApi`, `restoreConnection`, `disconnect`**

```ts
  async function loadFromApi(baseUrl: string, apiKey: string, remember = false) {
    loading.value = true; error.value = null
    try {
      if (remember) {
        const { host } = await $fetch<{ host: string }>('/api/session', { method: 'POST', body: { baseUrl, apiKey } })
        graph.value = await $fetch<WorkflowGraph>('/api/ingest/api', { method: 'POST', body: {} })
        connectedHost.value = host
      } else {
        graph.value = await $fetch<WorkflowGraph>('/api/ingest/api', { method: 'POST', body: { baseUrl, apiKey } })
        connectedHost.value = hostOf(baseUrl)
      }
      connected.value = true
    } catch (e) { error.value = extractError(e) } finally { loading.value = false }
  }

  async function restoreConnection() {
    if (!import.meta.client) return
    let status: { connected: boolean; host?: string }
    try { status = await $fetch('/api/session') } catch { return }
    if (!status.connected) return
    connectedHost.value = status.host ?? null
    loading.value = true; error.value = null
    try {
      graph.value = await $fetch<WorkflowGraph>('/api/ingest/api', { method: 'POST', body: {} })
      connected.value = true
    } catch (e) {
      error.value = extractError(e)
      await $fetch('/api/session', { method: 'DELETE' }).catch(() => {})
      connectedHost.value = null
    } finally { loading.value = false }
  }

  async function disconnect() {
    if (import.meta.client) await $fetch('/api/session', { method: 'DELETE' }).catch(() => {})
    connected.value = false
    connectedHost.value = null
    graph.value = null
    selectedId.value = null
    selectedCredId.value = null
    selectedDataTableId.value = null
    focusNodeId.value = null
    tagFilter.value = []
    searchQuery.value = ''
    error.value = null
    view.value = 'map'
  }
```

- [ ] **Step 3: Remove the old `connectedHost` computed and fix the return**

Delete the line:

```ts
  const connectedHost = computed(() => connection.value ? hostOf(connection.value.baseUrl) : null)
```

In the store's returned object, replace `connection, connectedHost` with `connected, connectedHost` (note: `connectedHost` is now a ref, not a computed). The full return becomes:

```ts
  return { graph, loading, error, selectedId, selected, selectedCredId, selectedCredential, selectedDataTableId, selectedDataTable, focusNodeId, tagFilter, searchQuery, loadFromApi, loadFromUpload, view, visibility, goToMapNode, connected, connectedHost, disconnect, restoreConnection }
```

- [ ] **Step 4: Lint + typecheck**

Run: `bun run lint`
Expected: 0 errors. (If `computed` is now unused, remove it from any explicit import — note this store relies on Nuxt auto-imports, so there is likely no explicit `computed` import to change.)

- [ ] **Step 5: Commit**

```bash
git add app/stores/graph.ts
git commit -m "feat(store): session-cookie connection state, drop client-side apiKey"
```

---

## Task 11: Toolbar — remember checkbox + copy

**Files:**
- Modify: `app/components/Toolbar.vue`

- [ ] **Step 1: Add the `remember` ref**

In `<script setup>`, next to the other refs (`baseUrl`, `apiKey`, `uploadBaseUrl`):

```ts
const remember = ref(false)
```

- [ ] **Step 2: Pass it to `loadFromApi` and add the checkbox**

Change the connected-host references from `store.connectedHost` (still works) and update the API row. Replace the existing API connect row:

```vue
        <div class="row">
          <input v-model="baseUrl" placeholder="https://n8n.example.com" />
          <span class="apikey">
            <input v-model="apiKey" type="password" placeholder="API key" />
            <span class="help" tabindex="0" aria-label="API key permissions">?
              <span class="tip">This app only reads. Required scopes:
                <strong>Workflow: List</strong> and <strong>Workflow: Read</strong>.
                Optional read-only scopes <strong>Credential: List</strong> and
                <strong>Data Table: List</strong> enrich the credential and data-table
                views with unused items and extra metadata. No write access is ever needed.</span>
            </span>
          </span>
          <button :disabled="store.loading" @click="store.loadFromApi(baseUrl, apiKey, remember)">Load via API</button>
        </div>
        <label class="remember">
          <input type="checkbox" v-model="remember" />
          Remember on this device (7 days)
        </label>
```

- [ ] **Step 3: Update the privacy hint copy**

Replace the existing hint span (currently "API key stored for this browser session only."):

```vue
          <span class="hint">By default the API key is used once and never stored. "Remember" keeps it in an encrypted, server-only cookie.</span>
```

- [ ] **Step 4: Add styling for the checkbox**

Append to the `<style scoped>` block:

```css
.remember { display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; color: var(--text-dim); font-size: 12px; cursor: pointer; }
.remember input { accent-color: var(--accent); }
```

- [ ] **Step 5: Lint**

Run: `bun run lint`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add app/components/Toolbar.vue
git commit -m "feat(toolbar): remember-me checkbox and updated key-storage copy"
```

---

## Task 12: Delete `useConnectionStorage`

**Files:**
- Delete: `app/composables/useConnectionStorage.ts`, `app/composables/useConnectionStorage.test.ts`

- [ ] **Step 1: Confirm there are no remaining importers**

Run: `grep -rn "useConnectionStorage" app server shared`
Expected: no matches (Task 10 removed the store import; `hostOf` now comes from `#shared/url`).

- [ ] **Step 2: Delete the files**

```bash
git rm app/composables/useConnectionStorage.ts app/composables/useConnectionStorage.test.ts
```

- [ ] **Step 3: Run the full suite + lint**

Run: `bun run test && bun run lint`
Expected: all tests PASS, 0 lint errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove web-storage connection module (key no longer stored client-side)"
```

---

## Task 13: Document the env var

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a configuration note**

Add to the relevant configuration/deployment section of `README.md`:

```markdown
### Session secret (remember-me)

The "Remember on this device" option seals the n8n API key into an encrypted,
httpOnly cookie. Set a strong sealing password in production:

```
NUXT_SESSION_PASSWORD=<random string, at least 32 characters>
```

On Vercel, add it under Project → Settings → Environment Variables. If it is
unset in production, remember-me is disabled and the app falls back to the
default in-memory behavior (the key is used once per request and never stored).
By default (without remembering), no API key is ever persisted client- or
server-side.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document NUXT_SESSION_PASSWORD for remember-me"
```

---

## Final verification

- [ ] **Step 1: Full suite + lint**

Run: `bun run test && bun run lint`
Expected: all tests PASS, 0 lint errors.

- [ ] **Step 2: Manual smoke (dev server)**

Run: `bun run dev`, then in the browser:
- Connect via API with "Remember" **unchecked** → graph loads. Reload → connection is gone (re-entry required). Confirm no `n8nviz.conn` and no `n8nviz_sess` survives a JS read (`document.cookie` must not show the key; `n8nviz_sess` is httpOnly so it won't appear).
- Connect with "Remember" **checked** → graph loads. Reload → still connected (graph restores). `document.cookie` does **not** expose `n8nviz_sess` (httpOnly). Disconnect → reload → not connected.

---

## Self-review notes

- **Spec coverage:** endpoints (T6), body-or-cookie precedence (T3/T7), CSRF SameSite+Origin (T2/T4), 7-day Secure httpOnly cookie (T4), secret + graceful degradation (T5/T6), client rework + removed storage (T10/T11/T12), rate-limit (T8), README (T13), tests for the pure helpers (T1/T3/T4/T8/T9). All spec sections map to a task.
- **Type consistency:** `SessionData` defined once in `creds.ts` and imported by `store.ts`; `sessionConfig(password, dev)` signature consistent across T4/T6/T7; `resolveSessionPassword(event)` consistent across T5/T6/T7; `loadFromApi(baseUrl, apiKey, remember)` consistent T10/T11.
- **Degradation:** `/api/ingest/api` body path needs no secret, so the app stays fully usable when `NUXT_SESSION_PASSWORD` is unset; only remember-me (`POST /api/session`) 500s.
