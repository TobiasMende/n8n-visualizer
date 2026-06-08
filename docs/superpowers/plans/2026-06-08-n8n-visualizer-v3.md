# n8n Visualizer v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the empty Webhooks view, add a Credentials view, persist the n8n connection across refresh (sessionStorage), and make the Map's node-type overlay a per-type show/hide checklist.

**Architecture:** Server change is an isolated, hardened webhook-node extractor consumed by `buildWebhooks`. New client work is pure composables/helpers with thin Vue components, matching the v2 view pattern. Connection persistence and node-type-hiding logic are pure, injectable units the Pinia store wires up.

**Tech Stack:** Bun, Nuxt 4 (Vue 3, TS, Nitro), Vue Flow, Pinia, Vitest + @vue/test-utils.

## Conventions (from v1/v2)
- Nuxt 4 srcDir `app/`. Shared types `shared/types/graph.ts` via `#shared/...` (server + app). App code `~` = `app/`. Server under `server/`.
- Tests beside source; `bun run test -- <path>` or `bun run test`. Build `bun run build`. Dev `bun run dev` (script already `TMPDIR=/tmp nuxt dev`).
- Components with unit tests must `import { computed, ref } from 'vue'` explicitly.
- All existing 75 tests must stay green.

## File Structure
```
shared/types/graph.ts                  # MODIFY: RawNode.webhookId?
shared/prettify.ts                     # MOVED from server/catalog/prettify.ts (shared by server + app)
server/catalog/prettify.ts             # DELETE (moved)
server/catalog/catalog.ts              # MODIFY: import prettify from '#shared/prettify'
server/catalog/prettify.test.ts        # MOVE -> shared/prettify.test.ts
server/webhooks/extract.ts             # NEW: hardened webhook node extractor
server/webhooks/build.ts               # MODIFY: use extractor
app/composables/useCredentialView.ts   # NEW
app/components/CredentialsView.vue      # NEW
app/composables/useConnectionStorage.ts# NEW: pure session-storage helpers
app/composables/useMapLayers.ts        # MODIFY: hiddenNodeTypes param + allNodeTypes()
app/stores/graph.ts                    # MODIFY: ViewId+credentials, connection persistence, hiddenNodeTypes
app/components/AppShell.vue            # MODIFY: credentials rail entry
app/components/Toolbar.vue            # MODIFY: connected/disconnect UI
app/components/NodeTypeLayerPanel.vue # NEW
app/components/MapLayerToggles.vue    # MODIFY: node-type panel popover
app/components/WorkflowMap.vue        # MODIFY: pass hiddenNodeTypes
app/pages/index.vue                   # MODIFY: credentials view + bootstrap restore
```

---

# PHASE 1 — Webhooks extraction fix

## Task 1: Hardened webhook extractor

**Files:** Modify `shared/types/graph.ts`; create `server/webhooks/extract.ts`, `server/webhooks/extract.test.ts`; modify `server/webhooks/build.ts`.

- [ ] **Step 1: Add `webhookId` to RawNode**

In `shared/types/graph.ts`, add `webhookId?: string` to the `RawNode` interface (alongside `id?`, `name`, `type`, `parameters?`, `credentials?`).

- [ ] **Step 2: Write the failing extractor test**

Create `server/webhooks/extract.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { webhookNodeInfo } from './extract'
import type { RawNode } from '#shared/types/graph'

describe('webhookNodeInfo', () => {
  it('reads path + method from a standard webhook node', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: '/orders', httpMethod: 'POST' } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'orders', method: 'POST' })
  })
  it('falls back to webhookId when path is empty', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', webhookId: 'abc-123', parameters: { path: '' } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'abc-123', method: 'GET' })
  })
  it('reads method nested under options', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', options: { httpMethod: 'PUT' } } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'p', method: 'PUT' })
  })
  it('joins an array of methods', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', httpMethod: ['GET', 'POST'] } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'p', method: 'GET,POST' })
  })
  it('handles a form trigger', () => {
    const n: RawNode = { name: 'f', type: 'n8n-nodes-base.formTrigger', parameters: { path: 'signup' } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'signup', method: 'GET' })
  })
  it('returns null for non-webhook nodes and for nodes with no path/webhookId', () => {
    expect(webhookNodeInfo({ name: 's', type: 'n8n-nodes-base.set' })).toBeNull()
    expect(webhookNodeInfo({ name: 'h', type: 'n8n-nodes-base.webhook', parameters: {} })).toBeNull()
  })
})
```

- [ ] **Step 3: Run it red**

Run: `bun run test -- server/webhooks/extract.test.ts`
Expected: FAIL — cannot find module `./extract`.

- [ ] **Step 4: Implement the extractor**

Create `server/webhooks/extract.ts`:
```ts
import type { RawNode } from '#shared/types/graph'

const WEBHOOK_TYPES = new Set(['n8n-nodes-base.webhook', 'n8n-nodes-base.formTrigger'])

export interface WebhookNodeInfo { path: string; method: string }

export function webhookNodeInfo(node: RawNode): WebhookNodeInfo | null {
  if (!WEBHOOK_TYPES.has(node.type)) return null
  const p = node.parameters ?? {}
  let path = typeof p.path === 'string' ? p.path.replace(/^\/+|\/+$/g, '') : ''
  if (!path && typeof node.webhookId === 'string' && node.webhookId) path = node.webhookId
  if (!path) return null
  const raw = p.httpMethod ?? p.options?.httpMethod
  const method = Array.isArray(raw)
    ? raw.join(',')
    : (typeof raw === 'string' && raw ? raw : 'GET')
  return { path, method }
}
```

- [ ] **Step 5: Run it green**

Run: `bun run test -- server/webhooks/extract.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Rewrite buildWebhooks to use the extractor**

Replace `server/webhooks/build.ts`:
```ts
import type { RawWorkflow, WebhookEntry } from '#shared/types/graph'
import { webhookNodeInfo } from './extract'

export function buildWebhooks(workflows: RawWorkflow[], baseUrl: string | null): WebhookEntry[] {
  const base = baseUrl ? baseUrl.replace(/\/+$/, '') : null
  const out: WebhookEntry[] = []
  for (const wf of workflows ?? []) {
    for (const node of wf.nodes ?? []) {
      const info = webhookNodeInfo(node)
      if (!info) continue
      out.push({
        workflowId: wf.id,
        method: info.method,
        path: info.path,
        prodUrl: base ? `${base}/webhook/${info.path}` : null,
        testUrl: base ? `${base}/webhook-test/${info.path}` : null,
      })
    }
  }
  return out
}
```

- [ ] **Step 7: Run the webhook build tests + full suite**

Run: `bun run test -- server/webhooks/build.test.ts` then `bun run test`
Expected: existing build tests still PASS (method default GET, path trim, null base), full suite green.

- [ ] **Step 8: Commit**

```bash
git add shared/types/graph.ts server/webhooks/extract.ts server/webhooks/extract.test.ts server/webhooks/build.ts
git commit -m "fix: harden webhook extraction (webhookId fallback, options method, arrays, form triggers)"
```

---

# PHASE 2 — Credentials view

## Task 2: Move prettify to shared

**Files:** Create `shared/prettify.ts`, `shared/prettify.test.ts`; delete `server/catalog/prettify.ts`, `server/catalog/prettify.test.ts`; modify `server/catalog/catalog.ts`.

- [ ] **Step 1: Move the file**

Move `server/catalog/prettify.ts` to `shared/prettify.ts` (identical contents — the `prettifyType` function and `ACRONYMS` map). Move `server/catalog/prettify.test.ts` to `shared/prettify.test.ts` and change its import to `import { prettifyType } from './prettify'` (same relative path, still works). Delete the originals.

- [ ] **Step 2: Update the catalog import**

In `server/catalog/catalog.ts`, change `import { prettifyType } from './prettify'` to `import { prettifyType } from '#shared/prettify'`.

- [ ] **Step 3: Run affected tests + full suite**

Run: `bun run test -- shared/prettify.test.ts` then `bun run test -- server/catalog/catalog.test.ts` then `bun run test`
Expected: all PASS (prettify tests run from new location; catalog still resolves prettify).

- [ ] **Step 4: Build check**

Run: `bun run build`
Expected: clean (server still imports prettify via `#shared`).

- [ ] **Step 5: Commit**

```bash
git add shared/prettify.ts shared/prettify.test.ts server/catalog/catalog.ts
git rm server/catalog/prettify.ts server/catalog/prettify.test.ts
git commit -m "refactor: move prettifyType to shared for reuse by app code"
```

---

## Task 3: Credentials view composable

**Files:** Create `app/composables/useCredentialView.ts`, `app/composables/useCredentialView.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `app/composables/useCredentialView.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { credentialRows, credentialWorkflows } from './useCredentialView'
import type { WorkflowGraph } from '#shared/types/graph'

const graph: WorkflowGraph = {
  nodes: [
    { id: 'a', name: 'Alpha', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 } },
    { id: 'b', name: 'Beta', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 } },
  ],
  edges: [], unresolved: [], skipped: [], webhooks: [], schedules: [],
  credentials: [
    { id: '1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['a', 'b'] },
    { id: null, name: 'Slack Bot', type: 'slackApi', workflowIds: ['b'] },
  ],
}

describe('credentialRows', () => {
  it('maps credentials with a readable type and workflow count', () => {
    const rows = credentialRows(graph)
    expect(rows[0]).toMatchObject({ name: 'My API', type: 'httpHeaderAuth', displayType: 'Http Header Auth', workflowCount: 2 })
    expect(rows[1]).toMatchObject({ name: 'Slack Bot', displayType: 'Slack Api', workflowCount: 1 })
  })
  it('returns [] for a null graph', () => {
    expect(credentialRows(null)).toEqual([])
  })
})

describe('credentialWorkflows', () => {
  it('resolves workflow ids to names for a credential', () => {
    expect(credentialWorkflows(graph, '1', 'httpHeaderAuth', 'My API'))
      .toEqual([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }])
  })
})
```
Note `prettifyType('httpHeaderAuth')` → `'Http Header Auth'` and `prettifyType('slackApi')` → `'Slack Api'` (API isn't a separate camel word here since the source is `slackApi` → split to `slack Api` → "Slack Api"; this is the accepted heuristic for credential types).

- [ ] **Step 2: Run it red**

Run: `bun run test -- app/composables/useCredentialView.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/composables/useCredentialView.ts`:
```ts
import type { WorkflowGraph } from '#shared/types/graph'
import { prettifyType } from '#shared/prettify'

export interface CredentialRow {
  id: string | null; name: string; type: string; displayType: string
  workflowCount: number; workflowIds: string[]
}

export function credentialRows(graph: WorkflowGraph | null): CredentialRow[] {
  if (!graph) return []
  return graph.credentials.map(c => ({
    id: c.id, name: c.name, type: c.type, displayType: prettifyType(c.type),
    workflowCount: c.workflowIds.length, workflowIds: c.workflowIds,
  }))
}

export function credentialWorkflows(
  graph: WorkflowGraph | null, id: string | null, type: string, name: string,
): { id: string; name: string }[] {
  if (!graph) return []
  const cred = graph.credentials.find(c => c.type === type && c.name === name && c.id === id)
  if (!cred) return []
  const nameById = new Map(graph.nodes.map(n => [n.id, n.name]))
  return cred.workflowIds.map(wfId => ({ id: wfId, name: nameById.get(wfId) ?? wfId }))
}
```

- [ ] **Step 4: Run it green**

Run: `bun run test -- app/composables/useCredentialView.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useCredentialView.ts app/composables/useCredentialView.test.ts
git commit -m "feat: credential view projection"
```

---

## Task 4: Credentials view component + rail/store/page wiring

**Files:** Create `app/components/CredentialsView.vue`; modify `app/stores/graph.ts`, `app/components/AppShell.vue`, `app/pages/index.vue`.

- [ ] **Step 1: Add the view id to the store**

In `app/stores/graph.ts`, change the `ViewId` type to include credentials:
```ts
  type ViewId = 'map' | 'webhooks' | 'schedules' | 'credentials'
```

- [ ] **Step 2: Add the rail entry**

In `app/components/AppShell.vue`, add to the `views` array (after schedules):
```ts
  { id: 'credentials', icon: '🔑', label: 'Credentials' },
```

- [ ] **Step 3: Create the component**

Create `app/components/CredentialsView.vue`:
```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { credentialRows, credentialWorkflows } from '~/composables/useCredentialView'

const store = useGraphStore()
const filter = ref('')
const expanded = ref<string | null>(null)

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'displayType', label: 'Type' },
  { key: 'workflowCount', label: 'Workflows' },
]
const rows = computed(() => credentialRows(store.graph))

function rowKey(r: { type: string; name: string; id: string | null }) { return `${r.type}:${r.name}:${r.id}` }
function toggle(key: string) { expanded.value = expanded.value === key ? null : key }
function jump(id: string) { store.selectedId = id; store.view = 'map' }
</script>

<template>
  <div class="wrap">
    <div class="bar"><input v-model="filter" class="search" placeholder="Filter credentials…" /></div>
    <DataTable :columns="columns" :rows="rows" :filter="filter">
      <template #cell-name="{ row }">
        <strong>{{ row.name }}</strong>
        <button class="exp" @click.stop="toggle(rowKey(row))">workflows</button>
        <ul v-if="expanded === rowKey(row)" class="wflist">
          <li v-for="w in credentialWorkflows(store.graph, row.id, row.type, row.name)" :key="w.id"
              @click.stop="jump(w.id)">↳ {{ w.name }}</li>
        </ul>
      </template>
      <template #cell-displayType="{ row }"><Badge>{{ row.displayType }}</Badge></template>
      <template #cell-workflowCount="{ row }">{{ row.workflowCount }}</template>
    </DataTable>
    <EmptyState v-if="!rows.length" title="No credentials" hint="No credentials referenced by any workflow." />
  </div>
</template>

<style scoped>
.wrap { position: relative; height: 100%; overflow: auto; padding: 12px; }
.bar { margin-bottom: 10px; }
.search { width: 280px; background: var(--bg-2); border: 1px solid var(--border); color: var(--text);
  border-radius: var(--radius-m); padding: 8px 10px; }
.exp { margin-left: 8px; font-size: 11px; background: none; border: 1px solid var(--border);
  color: var(--text-dim); border-radius: var(--radius-s); cursor: pointer; padding: 1px 6px; }
.wflist { margin: 6px 0 0; padding-left: 14px; color: var(--accent); font-size: 12px; }
.wflist li { cursor: pointer; }
</style>
```

- [ ] **Step 4: Wire into the page**

In `app/pages/index.vue`, add the credentials branch to the `<ClientOnly>` view switch (after schedules):
```vue
      <CredentialsView v-else-if="store.view === 'credentials' && store.graph" />
```

- [ ] **Step 5: Build + full suite**

Run: `bun run build` (clean) then `bun run test` (all pass; report count).

- [ ] **Step 6: Commit**

```bash
git add app/components/CredentialsView.vue app/stores/graph.ts app/components/AppShell.vue app/pages/index.vue
git commit -m "feat: Credentials view"
```

---

# PHASE 3 — Session persistence

## Task 5: Connection storage helper + store wiring

**Files:** Create `app/composables/useConnectionStorage.ts`, `app/composables/useConnectionStorage.test.ts`; modify `app/stores/graph.ts`.

- [ ] **Step 1: Write the failing helper test**

Create `app/composables/useConnectionStorage.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { saveConnection, loadConnection, clearConnection, hostOf } from './useConnectionStorage'

function fakeStorage(): Storage {
  const m = new Map<string, string>()
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    clear: () => m.clear(),
    key: () => null, length: 0,
  } as Storage
}

describe('connection storage', () => {
  it('saves and loads a connection', () => {
    const s = fakeStorage()
    saveConnection(s, { baseUrl: 'https://h', apiKey: 'k' })
    expect(loadConnection(s)).toEqual({ baseUrl: 'https://h', apiKey: 'k' })
  })
  it('returns null when nothing saved or value is malformed', () => {
    const s = fakeStorage()
    expect(loadConnection(s)).toBeNull()
    s.setItem('n8nviz.conn', '{bad json')
    expect(loadConnection(s)).toBeNull()
    s.setItem('n8nviz.conn', '{"baseUrl":"h"}')   // missing apiKey
    expect(loadConnection(s)).toBeNull()
  })
  it('clears a connection', () => {
    const s = fakeStorage()
    saveConnection(s, { baseUrl: 'https://h', apiKey: 'k' })
    clearConnection(s)
    expect(loadConnection(s)).toBeNull()
  })
  it('hostOf extracts the host, falling back to the raw string', () => {
    expect(hostOf('https://n8n.example.com/x')).toBe('n8n.example.com')
    expect(hostOf('not a url')).toBe('not a url')
  })
})
```

- [ ] **Step 2: Run it red**

Run: `bun run test -- app/composables/useConnectionStorage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/composables/useConnectionStorage.ts`:
```ts
export interface Conn { baseUrl: string; apiKey: string }
const KEY = 'n8nviz.conn'

export function saveConnection(s: Storage, conn: Conn): void {
  s.setItem(KEY, JSON.stringify(conn))
}
export function loadConnection(s: Storage): Conn | null {
  try {
    const raw = s.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    return (p && typeof p.baseUrl === 'string' && typeof p.apiKey === 'string') ? p : null
  } catch {
    return null
  }
}
export function clearConnection(s: Storage): void {
  s.removeItem(KEY)
}
export function hostOf(baseUrl: string): string {
  try { return new URL(baseUrl).host } catch { return baseUrl }
}
```

- [ ] **Step 4: Run it green**

Run: `bun run test -- app/composables/useConnectionStorage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire persistence into the store**

In `app/stores/graph.ts`:
1. Add import at top:
```ts
import { saveConnection, loadConnection, clearConnection, hostOf, type Conn } from '~/composables/useConnectionStorage'
```
2. Add a `connection` ref near the other refs:
```ts
  const connection = ref<Conn | null>(null)
```
3. In `loadFromApi`, on success (after `graph.value = ...`, before the `catch`), persist when no error. Replace the body of `loadFromApi` with:
```ts
  async function loadFromApi(baseUrl: string, apiKey: string) {
    loading.value = true; error.value = null
    try {
      graph.value = await $fetch<WorkflowGraph>('/api/ingest/api', { method: 'POST', body: { baseUrl, apiKey } })
      connection.value = { baseUrl, apiKey }
      if (import.meta.client) saveConnection(sessionStorage, connection.value)
    } catch (e) { error.value = extractError(e) } finally { loading.value = false }
  }
```
4. Add `disconnect` and `restoreConnection` (after `loadFromUpload`):
```ts
  function disconnect() {
    connection.value = null
    graph.value = null
    selectedId.value = null
    error.value = null
    if (import.meta.client) clearConnection(sessionStorage)
  }

  async function restoreConnection() {
    if (!import.meta.client) return
    const c = loadConnection(sessionStorage)
    if (!c) return
    connection.value = c
    await loadFromApi(c.baseUrl, c.apiKey)
    if (error.value) { connection.value = null; clearConnection(sessionStorage) }  // stale key → don't loop
  }

  const connectedHost = computed(() => connection.value ? hostOf(connection.value.baseUrl) : null)
```
5. Add `connection`, `connectedHost`, `disconnect`, `restoreConnection` to the returned object.

- [ ] **Step 6: Build + full suite**

Run: `bun run build` (clean) then `bun run test` (all pass; report count).

- [ ] **Step 7: Commit**

```bash
git add app/composables/useConnectionStorage.ts app/composables/useConnectionStorage.test.ts app/stores/graph.ts
git commit -m "feat: persist n8n connection in sessionStorage with disconnect/restore"
```

---

## Task 6: Connection UI + bootstrap restore

**Files:** Modify `app/components/Toolbar.vue`, `app/pages/index.vue`.

- [ ] **Step 1: Add connected/disconnect UI to the Toolbar**

In `app/components/Toolbar.vue`, replace the `<details open>` connect block (the API row + upload row) so that, when connected, it shows the connected host + Disconnect instead of the inputs. Replace lines from `<details open>` through its closing `</details>` with:
```vue
    <details :open="!store.connectedHost">
      <summary>{{ store.connectedHost ? `Connected to ${store.connectedHost}` : 'Connect' }}</summary>
      <template v-if="store.connectedHost">
        <div class="row">
          <button class="disconnect" @click="store.disconnect()">Disconnect</button>
          <span class="hint">API key stored for this browser session only.</span>
        </div>
      </template>
      <template v-else>
        <div class="row">
          <input v-model="baseUrl" placeholder="https://n8n.example.com" />
          <input v-model="apiKey" type="password" placeholder="API key" />
          <button :disabled="store.loading" @click="store.loadFromApi(baseUrl, apiKey)">Load via API</button>
        </div>
        <div class="row">
          <input v-model="uploadBaseUrl" placeholder="instance URL (optional, for links)" />
          <input type="file" accept="application/json" @change="onUpload" />
        </div>
      </template>
      <p v-if="store.error" class="err">{{ store.error }}</p>
    </details>
```
Add to the `<style scoped>` block:
```css
.disconnect { background: var(--bg-3); color: var(--text); border: 1px solid var(--border); border-radius: var(--radius-s); padding: 4px 10px; cursor: pointer; }
.hint { color: var(--text-faint); font-size: 11px; }
```

- [ ] **Step 2: Bootstrap auto-restore on mount**

In `app/pages/index.vue` `<script setup>`, add an on-mount call to restore the saved connection:
```ts
import { onMounted } from 'vue'
// ...existing store setup...
onMounted(() => { store.restoreConnection() })
```

- [ ] **Step 3: Build**

Run: `bun run build`
Expected: clean.

- [ ] **Step 4: Verify restore behavior manually (server route + reasoning)**

The full browser refresh-restore is a manual check (sessionStorage needs a browser). Confirm the wiring compiles and the store exposes `restoreConnection`/`disconnect`/`connectedHost` (grep):
```bash
grep -nE "restoreConnection|disconnect|connectedHost" app/stores/graph.ts
```
Expected: all three appear in the returned object. Note in your report that the live refresh-keeps-graph behavior remains for manual human verification.

- [ ] **Step 5: Commit**

```bash
git add app/components/Toolbar.vue app/pages/index.vue
git commit -m "feat: connected/disconnect toolbar UI + auto-restore on load"
```

---

# PHASE 4 — Per-node-type graph layers

## Task 7: hiddenNodeTypes in overlay + allNodeTypes helper

**Files:** Modify `app/composables/useMapLayers.ts`, `app/composables/useMapLayers.test.ts`.

- [ ] **Step 1: Add failing tests**

Append to `app/composables/useMapLayers.test.ts`:
```ts
import { overlayNodesAndEdges as overlay2, allNodeTypes } from './useMapLayers'

const g2 = {
  nodes: [
    { id: 'w', name: 'W', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 2, nodeTypes: [
        { type: 'n8n-nodes-base.set', displayName: 'Set', count: 1 },
        { type: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request', count: 1 },
      ], credentials: [], inbound: 0, outbound: 0 } },
  ],
  edges: [], unresolved: [], skipped: [], webhooks: [], schedules: [], credentials: [],
} as any
const pos2 = new Map([['w', { x: 0, y: 0 }]])

describe('allNodeTypes', () => {
  it('returns deduped node types sorted by display name', () => {
    expect(allNodeTypes(g2)).toEqual([
      { type: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request' },
      { type: 'n8n-nodes-base.set', displayName: 'Set' },
    ])
  })
})

describe('overlayNodesAndEdges hidden types', () => {
  it('skips node types listed in hiddenNodeTypes', () => {
    const r = overlay2(g2, pos2, { credentials: false, nodeTypes: true }, ['n8n-nodes-base.set'])
    const labels = r.nodes.filter(n => n.kind === 'nodeType').map(n => n.label)
    expect(labels).toEqual(['HTTP Request'])
  })
})
```

- [ ] **Step 2: Run it red**

Run: `bun run test -- app/composables/useMapLayers.test.ts`
Expected: FAIL — `allNodeTypes` not exported / 4th param not honored.

- [ ] **Step 3: Implement**

Edit `app/composables/useMapLayers.ts`:
1. Add the 4th parameter (default `[]` keeps existing 3-arg callers/tests valid) and skip hidden types. Change the signature and the nodeTypes loop:
```ts
export function overlayNodesAndEdges(
  graph: WorkflowGraph,
  basePos: Map<string, Point>,
  layers: { credentials: boolean; nodeTypes: boolean },
  hiddenNodeTypes: string[] = [],
): { nodes: OverlayNode[]; edges: OverlayEdge[] } {
```
and inside the `if (layers.nodeTypes)` block, at the top of the inner `for (const t of n.summary.nodeTypes)` loop:
```ts
      for (const t of n.summary.nodeTypes) {
        if (hiddenNodeTypes.includes(t.type)) continue
        const id = `type:${t.type}`
        // ...unchanged...
```
2. Add the helper at the bottom of the file:
```ts
export function allNodeTypes(graph: WorkflowGraph | null): { type: string; displayName: string }[] {
  if (!graph) return []
  const m = new Map<string, string>()
  for (const n of graph.nodes)
    for (const t of n.summary.nodeTypes)
      if (!m.has(t.type)) m.set(t.type, t.displayName)
  return [...m.entries()]
    .map(([type, displayName]) => ({ type, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}
```

- [ ] **Step 4: Run it green**

Run: `bun run test -- app/composables/useMapLayers.test.ts`
Expected: PASS (existing 3 + 2 new).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useMapLayers.ts app/composables/useMapLayers.test.ts
git commit -m "feat: per-type hiding in overlay + allNodeTypes helper"
```

---

## Task 8: hiddenNodeTypes store state + Map wiring + type panel

**Files:** Modify `app/stores/graph.ts`, `app/components/WorkflowMap.vue`, `app/components/MapLayerToggles.vue`; create `app/components/NodeTypeLayerPanel.vue`.

- [ ] **Step 1: Add hiddenNodeTypes to the store + persist it**

In `app/stores/graph.ts`:
1. Add ref near the others: `const hiddenNodeTypes = ref<string[]>([])`
2. In the prefs hydration block, add: `if (p.hiddenNodeTypes) hiddenNodeTypes.value = p.hiddenNodeTypes`
3. Add `hiddenNodeTypes` to the `watch([...])` dependency array AND to the persisted object:
```ts
    watch([view, layers, linkTypes, tagFilter, hiddenNodeTypes], () => {
      localStorage.setItem('n8nviz.prefs', JSON.stringify({
        view: view.value, layers: layers.value, linkTypes: linkTypes.value,
        tagFilter: tagFilter.value, hiddenNodeTypes: hiddenNodeTypes.value,
      }))
    }, { deep: true })
```
4. Add `hiddenNodeTypes` to the returned object.

- [ ] **Step 2: Pass hiddenNodeTypes into the overlay in the Map**

In `app/components/WorkflowMap.vue`, find the shared `overlay` computed (it calls `overlayNodesAndEdges(store.graph, positions.value, store.layers)`) and add the 4th arg:
```ts
const overlay = computed(() => store.graph
  ? overlayNodesAndEdges(store.graph, positions.value, store.layers, store.hiddenNodeTypes)
  : { nodes: [], edges: [] })
```

- [ ] **Step 3: Create the type panel**

Create `app/components/NodeTypeLayerPanel.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { allNodeTypes } from '~/composables/useMapLayers'

const store = useGraphStore()
const types = computed(() => allNodeTypes(store.graph))

function visible(type: string) { return !store.hiddenNodeTypes.includes(type) }
function toggle(type: string) {
  store.hiddenNodeTypes = visible(type)
    ? [...store.hiddenNodeTypes, type]
    : store.hiddenNodeTypes.filter(t => t !== type)
}
function showAll() { store.hiddenNodeTypes = [] }
function hideAll() { store.hiddenNodeTypes = types.value.map(t => t.type) }
</script>

<template>
  <div class="panel">
    <div class="head">
      <span>Node types</span>
      <span class="acts"><button @click="showAll">all</button><button @click="hideAll">none</button></span>
    </div>
    <label v-for="t in types" :key="t.type" class="item">
      <input type="checkbox" :checked="visible(t.type)" @change="toggle(t.type)" />
      <span>{{ t.displayName }}</span>
    </label>
    <p v-if="!types.length" class="empty">No node types in graph.</p>
  </div>
</template>

<style scoped>
.panel { position: absolute; top: 100%; right: 0; margin-top: 6px; width: 240px; max-height: 320px; overflow: auto;
  background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-m); box-shadow: var(--shadow-1);
  padding: 8px; z-index: 20; }
.head { display: flex; justify-content: space-between; align-items: center; color: var(--text-dim);
  font-size: 11px; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
.acts button { background: none; border: 1px solid var(--border); color: var(--text-dim); border-radius: var(--radius-s);
  font-size: 10px; padding: 1px 6px; margin-left: 4px; cursor: pointer; }
.item { display: flex; align-items: center; gap: 8px; padding: 3px 2px; font-size: 13px; color: var(--text); cursor: pointer; }
.empty { color: var(--text-faint); font-size: 12px; }
</style>
```

- [ ] **Step 4: Add the panel popover to the layer toggles**

Replace `app/components/MapLayerToggles.vue`:
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useGraphStore } from '~/stores/graph'
const store = useGraphStore()
const showTypes = ref(false)
</script>
<template>
  <div class="toggles">
    <IconButton :active="store.layers.credentials" title="Toggle credential nodes"
      @click="store.layers.credentials = !store.layers.credentials">🔑 Credentials</IconButton>
    <div class="wrap">
      <IconButton :active="store.layers.nodeTypes" title="Toggle node-type nodes"
        @click="store.layers.nodeTypes = !store.layers.nodeTypes">◆ Node types</IconButton>
      <IconButton v-if="store.layers.nodeTypes" :active="showTypes" title="Choose visible node types"
        @click="showTypes = !showTypes">⋯</IconButton>
      <NodeTypeLayerPanel v-if="store.layers.nodeTypes && showTypes" />
    </div>
  </div>
</template>
<style scoped>
.toggles { display: flex; gap: 8px; }
.wrap { position: relative; display: flex; gap: 6px; }
</style>
```

- [ ] **Step 5: Build + full suite**

Run: `bun run build` (clean) then `bun run test` (all pass; report count).

- [ ] **Step 6: Commit**

```bash
git add app/stores/graph.ts app/components/WorkflowMap.vue app/components/MapLayerToggles.vue app/components/NodeTypeLayerPanel.vue
git commit -m "feat: per-node-type show/hide layer panel on the map"
```

---

## Task 9: Final verification (full suite, build, e2e)

**Files:** none (verification only).

- [ ] **Step 1: Full suite**

Run: `bun run test`
Expected: all tests pass (v1/v2 + all v3 additions). Report the count.

- [ ] **Step 2: Build**

Run: `bun run build`
Expected: clean.

- [ ] **Step 3: End-to-end webhook fix check**

Run (proves webhooks now populate from a webhookId-only node and a form trigger):
```bash
TMPDIR=/tmp bun run dev > /tmp/v3-e2e.log 2>&1 &
DEV=$!
for i in $(seq 1 40); do curl -s http://localhost:3000/ >/dev/null 2>&1 && break; sleep 1; done
curl -s -o /dev/null -w "index=%{http_code}\n" http://localhost:3000/
curl -s -X POST http://localhost:3000/api/ingest/upload -H 'content-type: application/json' \
  -d '{"baseUrl":"https://n8n.example.com","workflows":[
    {"id":"A","name":"Hooked","active":true,"nodes":[
      {"name":"wh","type":"n8n-nodes-base.webhook","webhookId":"abc-123","parameters":{"path":"","options":{"httpMethod":"PUT"}}},
      {"name":"form","type":"n8n-nodes-base.formTrigger","parameters":{"path":"signup"}}
    ]}
  ]}' | head -c 500
echo; kill $DEV 2>/dev/null
```
Expected: `index=200`; JSON `webhooks` has TWO entries — one with `path:"abc-123"`, `method:"PUT"`, `prodUrl:"https://n8n.example.com/webhook/abc-123"`, and one with `path:"signup"`, `method:"GET"`. This proves the "no rows" bug is fixed for the hardened shapes. Note that the browser-interaction checks (Credentials view, refresh-restore, node-type panel) remain for manual human verification.

- [ ] **Step 4: No commit needed** (verification only). If everything passes, the phase commits already cover the work.

---

## Self-Review Notes
- **Spec coverage:** Webhook fix — T1 (extractor handles webhookId/options/array/formTrigger) + e2e T9. Credentials view — T3 composable, T4 component+rail+page, prettify shared via T2. Session persistence — T5 helper+store (sessionStorage, disconnect, restore, stale-key clear), T6 UI + on-mount restore. Per-type layers — T7 overlay param+allNodeTypes, T8 store hiddenNodeTypes+persist+Map wiring+panel+toggles. All spec items mapped.
- **Type consistency:** `overlayNodesAndEdges` 4th param `hiddenNodeTypes: string[] = []` keeps existing 3-arg tests valid (T7). `ViewId` adds `'credentials'` once (T4) used by AppShell + page. `prettifyType` import path becomes `#shared/prettify` everywhere (T2) — catalog (server) and useCredentialView (app). `Conn` type shared between helper and store (T5). `hiddenNodeTypes` added to store return + prefs (T8).
- **Regressions handled:** moving prettify (T2) updates the catalog import and the test's location; full suite run confirms. buildWebhooks rewrite (T1) keeps the v2 build.test assertions valid (default GET, trim, null base). Existing useMapLayers 3-arg tests stay green via the default param.
- **Placeholder scan:** none. The manual-verification notes (refresh-restore, panels) are explicitly flagged as browser-only, not vague steps.
