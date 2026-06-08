# n8n Visualizer v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add data enrichment (readable node types, webhook URLs, parsed schedules, credentials), three views (Map / Webhooks / Schedules), and a "Control Room" dark design system to the v1 n8n cross-workflow map.

**Architecture:** Server enriches one `WorkflowGraph` (pure, fixture-tested units behind interfaces). The client renders three views as projections of that single graph, built on a design-token layer and reusable UI primitives. State + view prefs live in Pinia, persisted to localStorage.

**Tech Stack:** Bun, Nuxt 4 (Vue 3, TS, Nitro), Vue Flow, d3-force, Pinia, `cron-parser@^4`, Vitest + @vue/test-utils.

---

## Conventions (carried from v1)

- Nuxt 4 srcDir is `app/`. Shared types in `shared/types/graph.ts`, imported as `#shared/types/graph` from server AND app. Inside app code `~` = `app/`.
- Server code under `server/`. Tests sit beside source; run `bun run test -- <path>` (or `bun run test` for all). Build: `bun run build`.
- Vitest aliases already set: `#shared`→`shared/`, `~`/`@`→`app/`.
- Components with unit tests must `import { computed, ref } from 'vue'` explicitly (Nuxt auto-imports are absent in vitest).
- All 38 v1 tests must stay green; tasks that touch v1 files say how to keep them passing.

## File Structure

```
shared/types/graph.ts                 # MODIFY: WebhookEntry, ScheduleEntry, CredentialRef, NodeTypeCount.displayName, graph fields
server/catalog/prettify.ts            # heuristic type→displayName
server/catalog/bundled.json           # snapshot of common n8n node displayNames
server/catalog/catalog.ts             # CatalogCache/CatalogSource interfaces + buildCatalog + NodeCatalog
server/catalog/disk-cache.ts          # CatalogCache disk impl
server/catalog/instance-source.ts     # CatalogSource live-fetch impl
server/webhooks/build.ts              # WebhookEntry[] from workflows + base
server/schedule/parse.ts              # parseSchedule -> cadenceText, cadenceGroup, cronExpr
server/schedule/next-fire.ts          # nextFire(cronExpr, from)
server/parser/credentials.ts          # CredentialRef[] from workflows
server/parser/build-graph.ts          # MODIFY: opts {from, catalog}, enrich nodeTypes, attach webhooks/schedules/credentials
server/api/ingest/api.post.ts         # MODIFY: pass from + live catalog
server/api/ingest/upload.post.ts      # MODIFY: pass from + bundled catalog
app/assets/tokens.css                 # design tokens (Control Room)
app/components/ui/Panel.vue           # primitives
app/components/ui/Badge.vue
app/components/ui/IconButton.vue
app/components/ui/EmptyState.vue
app/components/ui/DataTable.vue
app/components/AppShell.vue           # rail + topbar + slot
app/components/MapLayerToggles.vue
app/composables/useMapLayers.ts       # overlay nodes/edges
app/composables/useWebhookView.ts     # webhook table projection + callers
app/composables/useScheduleView.ts    # grouped schedules + countdown helpers
app/components/WebhooksView.vue
app/components/SchedulesView.vue
app/components/WorkflowMap.vue         # MODIFY: layers + restyle
app/components/WorkflowNodeCard.vue    # MODIFY: restyle + node kinds
app/components/SidePanel.vue           # MODIFY: restyle + readable types
app/stores/graph.ts                    # MODIFY: view state + persistence
app/pages/index.vue                    # MODIFY: shell + view switch
nuxt.config.ts                         # MODIFY: include tokens.css
```

---

# PHASE 1 — Enrichment + data model (server)

## Task 1: Extend shared types

**Files:** Modify `shared/types/graph.ts`

- [ ] **Step 1: Add the new types and fields**

Edit `shared/types/graph.ts`:
1. Change `NodeTypeCount` to include a display name:
```ts
export interface NodeTypeCount { type: string; displayName: string; count: number }
```
2. Add these interfaces:
```ts
export type CadenceGroup =
  | 'sub-minute' | 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'cron'

export interface WebhookEntry {
  workflowId: string
  method: string
  path: string
  prodUrl: string | null
  testUrl: string | null
}

export interface ScheduleEntry {
  workflowId: string
  cadenceText: string
  cadenceGroup: CadenceGroup
  nextFire: string | null
}

export interface CredentialRef {
  id: string | null
  name: string
  type: string
  workflowIds: string[]
}
```
3. Add fields to `WorkflowGraph`:
```ts
export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  unresolved: UnresolvedLink[]
  skipped: SkippedWorkflow[]
  webhooks: WebhookEntry[]
  schedules: ScheduleEntry[]
  credentials: CredentialRef[]
}
```

- [ ] **Step 2: Typecheck the file**

Run: `bunx tsc --noEmit --strict --skipLibCheck shared/types/graph.ts`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add shared/types/graph.ts
git commit -m "feat: extend graph types for webhooks, schedules, credentials, readable node types"
```

---

## Task 2: Catalog — heuristic prettify

**Files:** Create `server/catalog/prettify.ts`, `server/catalog/prettify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/catalog/prettify.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { prettifyType } from './prettify'

describe('prettifyType', () => {
  it('strips the base package prefix and title-cases', () => {
    expect(prettifyType('n8n-nodes-base.set')).toBe('Set')
  })
  it('splits camelCase words', () => {
    expect(prettifyType('n8n-nodes-base.noOp')).toBe('No Op')
  })
  it('fixes known acronyms', () => {
    expect(prettifyType('n8n-nodes-base.httpRequest')).toBe('HTTP Request')
  })
  it('handles scoped community packages', () => {
    expect(prettifyType('@acme/n8n-nodes-foo.myCoolNode')).toBe('My Cool Node')
  })
  it('falls back to the raw string when there is no dot', () => {
    expect(prettifyType('weird')).toBe('Weird')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- server/catalog/prettify.test.ts`
Expected: FAIL — cannot find module `./prettify`.

- [ ] **Step 3: Write the implementation**

Create `server/catalog/prettify.ts`:
```ts
const ACRONYMS: Record<string, string> = {
  http: 'HTTP', https: 'HTTPS', api: 'API', url: 'URL', ai: 'AI',
  s3: 'S3', sql: 'SQL', html: 'HTML', xml: 'XML', json: 'JSON',
  csv: 'CSV', ftp: 'FTP', ssh: 'SSH', oauth: 'OAuth', id: 'ID',
}

export function prettifyType(type: string): string {
  const afterDot = type.includes('.') ? type.slice(type.lastIndexOf('.') + 1) : type
  const words = afterDot
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return words
    .map(w => ACRONYMS[w.toLowerCase()] ?? (w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- server/catalog/prettify.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/catalog/prettify.ts server/catalog/prettify.test.ts
git commit -m "feat: heuristic node-type prettifier"
```

---

## Task 3: Catalog — layered resolver

**Files:** Create `server/catalog/catalog.ts`, `server/catalog/bundled.json`, `server/catalog/catalog.test.ts`

- [ ] **Step 1: Create the bundled snapshot**

Create `server/catalog/bundled.json` (a starter map of common built-ins; extend freely):
```json
{
  "n8n-nodes-base.httpRequest": "HTTP Request",
  "n8n-nodes-base.webhook": "Webhook",
  "n8n-nodes-base.set": "Edit Fields (Set)",
  "n8n-nodes-base.if": "If",
  "n8n-nodes-base.switch": "Switch",
  "n8n-nodes-base.merge": "Merge",
  "n8n-nodes-base.code": "Code",
  "n8n-nodes-base.function": "Function",
  "n8n-nodes-base.scheduleTrigger": "Schedule Trigger",
  "n8n-nodes-base.cron": "Cron",
  "n8n-nodes-base.manualTrigger": "Manual Trigger",
  "n8n-nodes-base.executeWorkflow": "Execute Sub-workflow",
  "n8n-nodes-base.noOp": "No Operation",
  "n8n-nodes-base.emailSend": "Send Email",
  "n8n-nodes-base.slack": "Slack",
  "n8n-nodes-base.postgres": "Postgres",
  "n8n-nodes-base.googleSheets": "Google Sheets"
}
```

- [ ] **Step 2: Write the failing test**

Create `server/catalog/catalog.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest'
import { buildCatalog } from './catalog'
import type { CatalogCache, CatalogSource } from './catalog'

const bundled = { 'n8n-nodes-base.set': 'Edit Fields (Set)' }
const noCache: CatalogCache = { get: async () => null, set: async () => {} }
const noSource: CatalogSource = { fetch: async () => null }

describe('buildCatalog', () => {
  it('prefers a cached map', async () => {
    const cache: CatalogCache = { get: async () => ({ 'n8n-nodes-base.foo': 'Cached Foo' }), set: async () => {} }
    const cat = await buildCatalog({ host: 'h', cache, source: noSource, bundled })
    expect(cat.displayName('n8n-nodes-base.foo')).toBe('Cached Foo')
  })

  it('fetches live when no cache, and writes it back', async () => {
    const set = vi.fn(async () => {})
    const cache: CatalogCache = { get: async () => null, set }
    const source: CatalogSource = { fetch: async () => ({ 'n8n-nodes-base.bar': 'Live Bar' }) }
    const cat = await buildCatalog({ host: 'h', cache, source, bundled })
    expect(cat.displayName('n8n-nodes-base.bar')).toBe('Live Bar')
    expect(set).toHaveBeenCalledWith('h', { 'n8n-nodes-base.bar': 'Live Bar' })
  })

  it('falls back to bundled, then to prettify', async () => {
    const cat = await buildCatalog({ host: null, cache: noCache, source: noSource, bundled })
    expect(cat.displayName('n8n-nodes-base.set')).toBe('Edit Fields (Set)')   // bundled
    expect(cat.displayName('n8n-nodes-base.httpRequest')).toBe('HTTP Request') // prettify
  })

  it('does not fetch when host is null', async () => {
    const fetch = vi.fn(async () => null)
    await buildCatalog({ host: null, cache: noCache, source: { fetch }, bundled })
    expect(fetch).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test -- server/catalog/catalog.test.ts`
Expected: FAIL — cannot find module `./catalog`.

- [ ] **Step 4: Write the implementation**

Create `server/catalog/catalog.ts`:
```ts
import { prettifyType } from './prettify'

export interface NodeCatalog { displayName(type: string): string }
export interface CatalogCache {
  get(host: string): Promise<Record<string, string> | null>
  set(host: string, map: Record<string, string>): Promise<void>
}
export interface CatalogSource {
  fetch(host: string): Promise<Record<string, string> | null>
}

export async function buildCatalog(opts: {
  host: string | null
  cache: CatalogCache
  source: CatalogSource
  bundled: Record<string, string>
}): Promise<NodeCatalog> {
  const { host, cache, source, bundled } = opts
  let live: Record<string, string> | null = null

  if (host) {
    live = await cache.get(host)
    if (!live) {
      live = await source.fetch(host)
      if (live) await cache.set(host, live)
    }
  }

  return {
    displayName(type: string): string {
      return live?.[type] ?? bundled[type] ?? prettifyType(type)
    },
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- server/catalog/catalog.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add server/catalog/catalog.ts server/catalog/bundled.json server/catalog/catalog.test.ts
git commit -m "feat: layered node-catalog resolver"
```

---

## Task 4: Catalog — disk cache & instance source adapters

**Files:** Create `server/catalog/disk-cache.ts`, `server/catalog/instance-source.ts`

These are thin I/O adapters implementing the interfaces from Task 3. No unit tests (pure I/O); verified via build + the route smoke test in Task 9.

- [ ] **Step 1: Write the disk cache**

Create `server/catalog/disk-cache.ts`:
```ts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CatalogCache } from './catalog'

const TTL_MS = 7 * 24 * 60 * 60 * 1000
const DIR = '.cache'

function safe(host: string): string {
  return host.replace(/[^a-z0-9.-]/gi, '_')
}

export function diskCatalogCache(): CatalogCache {
  return {
    async get(host) {
      try {
        const raw = await readFile(join(DIR, `node-catalog-${safe(host)}.json`), 'utf8')
        const parsed = JSON.parse(raw) as { savedAt: number; map: Record<string, string> }
        if (Date.now() - parsed.savedAt > TTL_MS) return null
        return parsed.map
      } catch {
        return null
      }
    },
    async set(host, map) {
      try {
        await mkdir(DIR, { recursive: true })
        await writeFile(
          join(DIR, `node-catalog-${safe(host)}.json`),
          JSON.stringify({ savedAt: Date.now(), map }),
        )
      } catch {
        // cache write is best-effort
      }
    },
  }
}
```

- [ ] **Step 2: Write the instance source**

Create `server/catalog/instance-source.ts`:
```ts
import type { CatalogSource } from './catalog'

// Best-effort: try the instance's node-types description endpoint.
// Many instances will reject this without editor session auth — that's fine,
// we return null and the resolver falls back to bundled + prettify.
export function instanceCatalogSource(baseUrl: string, apiKey: string): CatalogSource {
  const base = baseUrl.replace(/\/+$/, '')
  return {
    async fetch() {
      try {
        const res = await fetch(`${base}/types/nodes.json`, {
          headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' },
        })
        if (!res.ok) return null
        const list = (await res.json()) as Array<{ name?: string; displayName?: string }>
        if (!Array.isArray(list)) return null
        const map: Record<string, string> = {}
        for (const n of list) if (n?.name && n?.displayName) map[n.name] = n.displayName
        return Object.keys(map).length ? map : null
      } catch {
        return null
      }
    },
  }
}
```

- [ ] **Step 3: Verify it builds**

Run: `bun run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add server/catalog/disk-cache.ts server/catalog/instance-source.ts
git commit -m "feat: disk cache and instance source for node catalog"
```

---

## Task 5: Webhooks — build entries

**Files:** Create `server/webhooks/build.ts`, `server/webhooks/build.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/webhooks/build.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildWebhooks } from './build'
import type { RawWorkflow } from '#shared/types/graph'

const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [
  { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: '/orders', httpMethod: 'POST' } },
  { name: 'noMethod', type: 'n8n-nodes-base.webhook', parameters: { path: 'health' } },
  { name: 'set', type: 'n8n-nodes-base.set' },
] }

describe('buildWebhooks', () => {
  it('builds prod/test URLs and defaults method to GET', () => {
    const got = buildWebhooks([wf], 'https://n8n.example.com/')
    expect(got).toEqual([
      { workflowId: 'a', method: 'POST', path: 'orders',
        prodUrl: 'https://n8n.example.com/webhook/orders',
        testUrl: 'https://n8n.example.com/webhook-test/orders' },
      { workflowId: 'a', method: 'GET', path: 'health',
        prodUrl: 'https://n8n.example.com/webhook/health',
        testUrl: 'https://n8n.example.com/webhook-test/health' },
    ])
  })

  it('leaves URLs null when no base is known', () => {
    const got = buildWebhooks([wf], null)
    expect(got[0].prodUrl).toBeNull()
    expect(got[0].testUrl).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- server/webhooks/build.test.ts`
Expected: FAIL — cannot find module `./build`.

- [ ] **Step 3: Write the implementation**

Create `server/webhooks/build.ts`:
```ts
import type { RawWorkflow, WebhookEntry } from '#shared/types/graph'
import { webhookPathOf } from '../parser/webhook-path'

export function buildWebhooks(workflows: RawWorkflow[], baseUrl: string | null): WebhookEntry[] {
  const base = baseUrl ? baseUrl.replace(/\/+$/, '') : null
  const out: WebhookEntry[] = []
  for (const wf of workflows ?? []) {
    for (const node of wf.nodes ?? []) {
      const path = webhookPathOf(node)
      if (path === null) continue
      const method = typeof node.parameters?.httpMethod === 'string'
        ? node.parameters.httpMethod : 'GET'
      out.push({
        workflowId: wf.id,
        method,
        path,
        prodUrl: base ? `${base}/webhook/${path}` : null,
        testUrl: base ? `${base}/webhook-test/${path}` : null,
      })
    }
  }
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- server/webhooks/build.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/webhooks/build.ts server/webhooks/build.test.ts
git commit -m "feat: build webhook entries with prod/test URLs"
```

---

## Task 6: Schedules — parse cadence

**Files:** Create `server/schedule/parse.ts`, `server/schedule/parse.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/schedule/parse.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseSchedule } from './parse'
import type { RawNode } from '#shared/types/graph'

const sched = (rule: any): RawNode =>
  ({ name: 's', type: 'n8n-nodes-base.scheduleTrigger', parameters: { rule } })

describe('parseSchedule', () => {
  it('parses a minutes interval', () => {
    const got = parseSchedule(sched({ interval: [{ field: 'minutes', minutesInterval: 15 }] }))
    expect(got).toEqual([{ cadenceText: 'Every 15 minutes', cadenceGroup: 'minutes', cronExpr: '*/15 * * * *' }])
  })

  it('parses a daily time', () => {
    const got = parseSchedule(sched({ interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 2, triggerAtMinute: 0 }] }))
    expect(got).toEqual([{ cadenceText: 'Every day at 02:00', cadenceGroup: 'daily', cronExpr: '0 2 * * *' }])
  })

  it('parses an explicit cron expression', () => {
    const got = parseSchedule(sched({ interval: [{ field: 'cronExpression', expression: '0 9 * * 1' }] }))
    expect(got).toEqual([{ cadenceText: 'Cron: 0 9 * * 1', cadenceGroup: 'cron', cronExpr: '0 9 * * 1' }])
  })

  it('parses seconds as sub-minute with no cron', () => {
    const got = parseSchedule(sched({ interval: [{ field: 'seconds', secondsInterval: 30 }] }))
    expect(got).toEqual([{ cadenceText: 'Every 30 seconds', cadenceGroup: 'sub-minute', cronExpr: null }])
  })

  it('returns [] for a non-schedule node', () => {
    expect(parseSchedule({ name: 'x', type: 'n8n-nodes-base.set' })).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- server/schedule/parse.test.ts`
Expected: FAIL — cannot find module `./parse`.

- [ ] **Step 3: Write the implementation**

Create `server/schedule/parse.ts`:
```ts
import type { RawNode, CadenceGroup } from '#shared/types/graph'

export interface ParsedCadence { cadenceText: string; cadenceGroup: CadenceGroup; cronExpr: string | null }

const hhmm = (h: number, m: number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function parseRule(rule: any): ParsedCadence | null {
  const min = Number(rule?.triggerAtMinute ?? 0)
  const hour = Number(rule?.triggerAtHour ?? 0)
  switch (rule?.field) {
    case 'seconds': {
      const n = Number(rule.secondsInterval ?? 1)
      return { cadenceText: `Every ${n} second${n === 1 ? '' : 's'}`, cadenceGroup: 'sub-minute', cronExpr: null }
    }
    case 'minutes': {
      const n = Number(rule.minutesInterval ?? 1)
      return { cadenceText: `Every ${n} minute${n === 1 ? '' : 's'}`, cadenceGroup: 'minutes', cronExpr: `*/${n} * * * *` }
    }
    case 'hours': {
      const n = Number(rule.hoursInterval ?? 1)
      return { cadenceText: `Every ${n} hour${n === 1 ? '' : 's'} at :${String(min).padStart(2, '0')}`, cadenceGroup: 'hourly', cronExpr: `${min} */${n} * * *` }
    }
    case 'days': {
      const n = Number(rule.daysInterval ?? 1)
      const text = n === 1 ? `Every day at ${hhmm(hour, min)}` : `Every ${n} days at ${hhmm(hour, min)}`
      return { cadenceText: text, cadenceGroup: 'daily', cronExpr: n === 1 ? `${min} ${hour} * * *` : `${min} ${hour} */${n} * *` }
    }
    case 'weeks': {
      const days: number[] = Array.isArray(rule.triggerAtDay) ? rule.triggerAtDay.map(Number) : [0]
      const names = days.map(d => DOW[d] ?? `Day ${d}`).join(', ')
      return { cadenceText: `Weekly on ${names} at ${hhmm(hour, min)}`, cadenceGroup: 'weekly', cronExpr: `${min} ${hour} * * ${days.join(',')}` }
    }
    case 'months': {
      const dom = Number(rule.triggerAtDayOfMonth ?? 1)
      return { cadenceText: `Monthly on day ${dom} at ${hhmm(hour, min)}`, cadenceGroup: 'monthly', cronExpr: `${min} ${hour} ${dom} * *` }
    }
    case 'cronExpression': {
      const expr = String(rule.expression ?? '').trim()
      if (!expr) return null
      return { cadenceText: `Cron: ${expr}`, cadenceGroup: 'cron', cronExpr: expr }
    }
    default:
      return null
  }
}

export function parseSchedule(node: RawNode): ParsedCadence[] {
  if (node.type === 'n8n-nodes-base.scheduleTrigger') {
    const rules: any[] = node.parameters?.rule?.interval ?? []
    return rules.map(parseRule).filter((r): r is ParsedCadence => r !== null)
  }
  if (node.type === 'n8n-nodes-base.cron') {
    const expr = node.parameters?.cronExpression
    if (typeof expr === 'string' && expr.trim())
      return [{ cadenceText: `Cron: ${expr.trim()}`, cadenceGroup: 'cron', cronExpr: expr.trim() }]
    return []
  }
  return []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- server/schedule/parse.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/schedule/parse.ts server/schedule/parse.test.ts
git commit -m "feat: parse n8n schedule/cron triggers into human cadences"
```

---

## Task 7: Schedules — next fire

**Files:** Create `server/schedule/next-fire.ts`, `server/schedule/next-fire.test.ts`. Add dependency `cron-parser`.

- [ ] **Step 1: Install cron-parser**

Run: `bun add cron-parser@^4`

- [ ] **Step 2: Write the failing test**

Create `server/schedule/next-fire.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { nextFire } from './next-fire'

describe('nextFire', () => {
  const from = '2026-06-08T01:00:00.000Z'

  it('computes the next occurrence of a daily cron after `from`', () => {
    // 02:00 UTC daily, from 01:00 → same day 02:00
    expect(nextFire('0 2 * * *', from)).toBe('2026-06-08T02:00:00.000Z')
  })

  it('rolls to the next day when the time has passed', () => {
    const after = '2026-06-08T03:00:00.000Z'
    expect(nextFire('0 2 * * *', after)).toBe('2026-06-09T02:00:00.000Z')
  })

  it('returns null for a null expression', () => {
    expect(nextFire(null, from)).toBeNull()
  })

  it('returns null for an invalid expression', () => {
    expect(nextFire('not a cron', from)).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test -- server/schedule/next-fire.test.ts`
Expected: FAIL — cannot find module `./next-fire`.

- [ ] **Step 4: Write the implementation**

Create `server/schedule/next-fire.ts`:
```ts
import cronParser from 'cron-parser'

export function nextFire(cronExpr: string | null, from: string): string | null {
  if (!cronExpr) return null
  try {
    const interval = cronParser.parseExpression(cronExpr, {
      currentDate: new Date(from),
      tz: 'UTC',
    })
    return interval.next().toDate().toISOString()
  } catch {
    return null
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- server/schedule/next-fire.test.ts`
Expected: PASS (4 tests). If the installed `cron-parser` major version exposes `CronExpressionParser.parse` instead of `parseExpression`, adjust the import/call accordingly (same inputs/outputs) and note it.

- [ ] **Step 6: Commit**

```bash
git add server/schedule/next-fire.ts server/schedule/next-fire.test.ts package.json bun.lock
git commit -m "feat: compute next-fire time from cron expression"
```

---

## Task 8: Credentials — extract refs

**Files:** Create `server/parser/credentials.ts`, `server/parser/credentials.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/parser/credentials.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { extractCredentials } from './credentials'
import type { RawWorkflow } from '#shared/types/graph'

const a: RawWorkflow = { id: 'a', name: 'A', nodes: [
  { name: 'h', type: 'n8n-nodes-base.httpRequest', credentials: { httpHeaderAuth: { id: '1', name: 'My API' } } },
] }
const b: RawWorkflow = { id: 'b', name: 'B', nodes: [
  { name: 'h', type: 'n8n-nodes-base.httpRequest', credentials: { httpHeaderAuth: { id: '1', name: 'My API' } } },
  { name: 's', type: 'n8n-nodes-base.slack', credentials: { slackApi: { name: 'Slack Bot' } } },
] }

describe('extractCredentials', () => {
  it('dedupes a shared credential and lists referencing workflows', () => {
    const got = extractCredentials([a, b])
    const api = got.find(c => c.name === 'My API')!
    expect(api).toEqual({ id: '1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['a', 'b'] })
  })

  it('captures a credential without an id', () => {
    const got = extractCredentials([b])
    expect(got.find(c => c.name === 'Slack Bot')).toEqual({ id: null, name: 'Slack Bot', type: 'slackApi', workflowIds: ['b'] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- server/parser/credentials.test.ts`
Expected: FAIL — cannot find module `./credentials`.

- [ ] **Step 3: Write the implementation**

Create `server/parser/credentials.ts`:
```ts
import type { RawWorkflow, CredentialRef } from '#shared/types/graph'

export function extractCredentials(workflows: RawWorkflow[]): CredentialRef[] {
  const byKey = new Map<string, CredentialRef>()
  for (const wf of workflows ?? []) {
    for (const node of wf.nodes ?? []) {
      for (const [type, cred] of Object.entries(node.credentials ?? {})) {
        if (!cred?.name) continue
        const key = `${type}:${cred.id ?? cred.name}`
        const existing = byKey.get(key)
        if (existing) {
          if (!existing.workflowIds.includes(wf.id)) existing.workflowIds.push(wf.id)
        } else {
          byKey.set(key, { id: cred.id ?? null, name: cred.name, type, workflowIds: [wf.id] })
        }
      }
    }
  }
  return [...byKey.values()]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- server/parser/credentials.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/parser/credentials.ts server/parser/credentials.test.ts
git commit -m "feat: extract deduped credential references"
```

---

## Task 9: Integrate enrichment into buildGraph + routes

**Files:** Modify `server/parser/summarize.ts`, `server/parser/build-graph.ts`, `server/parser/build-graph.test.ts`, `server/api/ingest/api.post.ts`, `server/api/ingest/upload.post.ts`

- [ ] **Step 1: Make summarize emit raw type counts (no displayName)**

In `server/parser/summarize.ts`, the histogram currently returns `{type,count}`. Keep that, but the RETURN TYPE must no longer claim to be `WorkflowSummary['nodeTypes']` (which now requires `displayName`). Change the `summarize` return type annotation to use a local raw shape:
```ts
export interface RawTypeCount { type: string; count: number }

export function summarize(wf: RawWorkflow): { nodeCount: number; nodeTypes: RawTypeCount[]; credentials: string[] } {
  // ... body unchanged ...
}
```
The existing `summarize.test.ts` asserts `s.nodeTypes[0]` equals `{ type, count }` — that stays valid.

- [ ] **Step 2: Add the failing build-graph test for enrichment**

Append to `server/parser/build-graph.test.ts`:
```ts
import type { NodeCatalog } from '../catalog/catalog'

const stubCatalog: NodeCatalog = { displayName: (t) => (t === 'n8n-nodes-base.webhook' ? 'Webhook' : t) }

describe('buildGraph enrichment', () => {
  const wf: RawWorkflow = { id: 'w', name: 'W', active: true, nodes: [
    { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', httpMethod: 'POST' } },
    { name: 's', type: 'n8n-nodes-base.scheduleTrigger', parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 2, triggerAtMinute: 0 }] } } },
    { name: 'h', type: 'n8n-nodes-base.httpRequest', credentials: { httpHeaderAuth: { id: '1', name: 'My API' } } },
  ] }

  it('attaches webhooks, schedules, credentials and readable node-type names', () => {
    const g = buildGraph([wf], 'https://n8n.example.com', { from: '2026-06-08T00:00:00.000Z', catalog: stubCatalog })
    expect(g.webhooks).toHaveLength(1)
    expect(g.webhooks[0].prodUrl).toBe('https://n8n.example.com/webhook/p')
    expect(g.schedules[0].cadenceText).toBe('Every day at 02:00')
    expect(g.schedules[0].nextFire).toBe('2026-06-08T02:00:00.000Z')
    expect(g.credentials.find(c => c.name === 'My API')!.workflowIds).toEqual(['w'])
    const wh = g.nodes[0].summary.nodeTypes.find(t => t.type === 'n8n-nodes-base.webhook')!
    expect(wh.displayName).toBe('Webhook')
  })

  it('still works with no opts (v1 call style)', () => {
    const g = buildGraph([wf], null)
    expect(g.webhooks[0].prodUrl).toBeNull()
    expect(g.schedules[0].nextFire).toBeNull()
    expect(g.nodes[0].summary.nodeTypes[0].displayName).toBeTypeOf('string')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test -- server/parser/build-graph.test.ts`
Expected: FAIL — `buildGraph` doesn't accept opts / missing webhooks/schedules/credentials.

- [ ] **Step 4: Update buildGraph**

Edit `server/parser/build-graph.ts`:
1. Add imports:
```ts
import type { NodeCatalog } from '../catalog/catalog'
import { prettifyType } from '../catalog/prettify'
import { buildWebhooks } from '../webhooks/build'
import { parseSchedule } from '../schedule/parse'
import { nextFire } from '../schedule/next-fire'
import { extractCredentials } from './credentials'
import type { ScheduleEntry } from '#shared/types/graph'
```
2. Change the signature and assemble enrichment. Replace the function signature line and the return with:
```ts
export function buildGraph(
  workflows: RawWorkflow[],
  baseUrl: string | null,
  opts: { from?: string; catalog?: NodeCatalog } = {},
): WorkflowGraph {
  const catalog: NodeCatalog = opts.catalog ?? { displayName: prettifyType }
  const from = opts.from ?? new Date(0).toISOString()
  // ... existing valid/skipped/edges/inbound/outbound logic unchanged ...
```
3. In the `nodes` map, enrich `nodeTypes` with `displayName`:
```ts
    summary: {
      ...summarize(wf),
      nodeTypes: summarize(wf).nodeTypes.map(t => ({ ...t, displayName: catalog.displayName(t.type) })),
      inbound: inbound.get(wf.id) ?? 0,
      outbound: outbound.get(wf.id) ?? 0,
    },
```
(If concerned about calling `summarize` twice, hoist it to `const s = summarize(wf)` above the object and reuse.)
4. Before `return`, build the enrichment arrays:
```ts
  const webhooks = buildWebhooks(valid, baseUrl)
  const schedules: ScheduleEntry[] = []
  for (const wf of valid)
    for (const node of wf.nodes ?? [])
      for (const c of parseSchedule(node))
        schedules.push({ workflowId: wf.id, cadenceText: c.cadenceText, cadenceGroup: c.cadenceGroup, nextFire: nextFire(c.cronExpr, from) })
  const credentials = extractCredentials(valid)
```
5. Return all fields:
```ts
  return { nodes, edges: keptEdges, unresolved, skipped, webhooks, schedules, credentials }
```

- [ ] **Step 5: Run the full suite**

Run: `bun run test`
Expected: all pass (v1 tests + new). If a v1 test constructs a `WorkflowNode` literal and TS complains at runtime — it won't (esbuild strips types); runtime asserts are unaffected.

- [ ] **Step 6: Wire the routes**

Edit `server/api/ingest/api.post.ts` to build a live catalog and pass `from`:
```ts
import { fetchAllWorkflows } from '../../ingest/n8n-client'
import { buildGraph } from '../../parser/build-graph'
import { buildCatalog } from '../../catalog/catalog'
import { diskCatalogCache } from '../../catalog/disk-cache'
import { instanceCatalogSource } from '../../catalog/instance-source'
import bundled from '../../catalog/bundled.json'

export default defineEventHandler(async (event) => {
  const { baseUrl, apiKey } = await readBody(event)
  if (!baseUrl || !apiKey)
    throw createError({ statusCode: 400, statusMessage: 'baseUrl and apiKey are required' })
  try {
    const workflows = await fetchAllWorkflows(baseUrl, apiKey)
    const host = new URL(baseUrl).host
    const catalog = await buildCatalog({
      host, cache: diskCatalogCache(), source: instanceCatalogSource(baseUrl, apiKey), bundled,
    })
    return buildGraph(workflows, baseUrl, { from: new Date().toISOString(), catalog })
  } catch (e: any) {
    throw createError({ statusCode: 502, statusMessage: e?.message ?? 'n8n fetch failed' })
  }
})
```
Edit `server/api/ingest/upload.post.ts` to pass `from` and a bundled-only catalog:
```ts
import { normalizeWorkflows } from '../../ingest/normalize'
import { buildGraph } from '../../parser/build-graph'
import { buildCatalog } from '../../catalog/catalog'
import bundled from '../../catalog/bundled.json'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const raw = body?.workflows ?? body
  const baseUrl = typeof body?.baseUrl === 'string' && body.baseUrl ? body.baseUrl : null
  const workflows = normalizeWorkflows(raw)
  const catalog = await buildCatalog({
    host: null, cache: { get: async () => null, set: async () => {} }, source: { fetch: async () => null }, bundled,
  })
  return buildGraph(workflows, baseUrl, { from: new Date().toISOString(), catalog })
})
```
Note: importing JSON needs `resolveJsonModule` — Nuxt/Nitro supports JSON imports by default; if the build complains, change the import to read the file via `import bundled from '../../catalog/bundled.json' assert { type: 'json' }` or a typed `as Record<string,string>` cast.

- [ ] **Step 7: Smoke-test the upload route**

Run:
```bash
TMPDIR=/tmp bun run dev > /tmp/v2-dev.log 2>&1 &
DEV=$!
for i in $(seq 1 30); do curl -s http://localhost:3000/ >/dev/null 2>&1 && break; sleep 1; done
curl -s -X POST http://localhost:3000/api/ingest/upload -H 'content-type: application/json' \
  -d '{"baseUrl":"https://n8n.example.com","workflows":[{"id":"w","name":"W","nodes":[
    {"name":"hook","type":"n8n-nodes-base.webhook","parameters":{"path":"orders","httpMethod":"POST"}},
    {"name":"s","type":"n8n-nodes-base.scheduleTrigger","parameters":{"rule":{"interval":[{"field":"days","daysInterval":1,"triggerAtHour":2,"triggerAtMinute":0}]}}}
  ]}]}'
echo; kill $DEV 2>/dev/null
```
Expected JSON includes `webhooks[0].prodUrl` = `https://n8n.example.com/webhook/orders`, `schedules[0].cadenceText` = `Every day at 02:00`, and `nodes[0].summary.nodeTypes` entries each with a `displayName`.

- [ ] **Step 8: Commit**

```bash
git add server/parser/summarize.ts server/parser/build-graph.ts server/parser/build-graph.test.ts server/api/ingest/api.post.ts server/api/ingest/upload.post.ts
git commit -m "feat: enrich WorkflowGraph with webhooks, schedules, credentials, readable types"
```

---

# PHASE 2 — Design system + Map upgrade (client)

## Task 10: Design tokens

**Files:** Create `app/assets/tokens.css`; modify `nuxt.config.ts`

- [ ] **Step 1: Write the tokens**

Create `app/assets/tokens.css`:
```css
:root {
  --bg-0: #0b0f1a; --bg-1: #0f1420; --bg-2: #151b2b; --bg-3: #1b2538;
  --border: #243049; --border-soft: #1c2336;
  --text: #cdd9f0; --text-dim: #7f8db0; --text-faint: #5b6680;
  --accent: #3ddc97; --accent-dim: #236047;
  --warn: #ffb454; --danger: #ef4444; --link: #6aa0ff;
  --radius-s: 6px; --radius-m: 10px; --radius-l: 14px;
  --shadow-1: 0 4px 18px rgba(0,0,0,.5);
  --shadow-glow: 0 0 0 1px rgba(61,220,151,.25), 0 4px 24px rgba(61,220,151,.12);
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 24px;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
  --dur: 160ms; --ease: cubic-bezier(.2,.6,.2,1);
}

* { box-sizing: border-box; }
html, body, #__nuxt { height: 100%; margin: 0; }
body { background: var(--bg-0); color: var(--text); font-family: var(--font-sans); }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-thumb { background: var(--bg-3); border-radius: 6px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 2: Register the stylesheet**

Edit `nuxt.config.ts` `css` array to include it first:
```ts
  css: ['~/assets/tokens.css', '@vue-flow/core/dist/style.css', '@vue-flow/core/dist/theme-default.css'],
```

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/assets/tokens.css nuxt.config.ts
git commit -m "feat: Control Room design tokens"
```

---

## Task 11: UI primitives

**Files:** Create `app/components/ui/Panel.vue`, `Badge.vue`, `IconButton.vue`, `EmptyState.vue`

No unit tests (presentational); verified by build and use. Each is tiny and token-driven.

- [ ] **Step 1: Panel**

Create `app/components/ui/Panel.vue`:
```vue
<template>
  <section class="panel"><slot /></section>
</template>
<style scoped>
.panel { background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-l);
  box-shadow: var(--shadow-1); }
</style>
```

- [ ] **Step 2: Badge**

Create `app/components/ui/Badge.vue`:
```vue
<script setup lang="ts">
defineProps<{ tone?: 'default' | 'accent' | 'warn' | 'danger' }>()
</script>
<template>
  <span class="badge" :class="tone ?? 'default'"><slot /></span>
</template>
<style scoped>
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px;
  font-size: 12px; background: var(--bg-3); color: var(--text); border: 1px solid var(--border); }
.accent { background: var(--accent-dim); color: var(--accent); border-color: transparent; }
.warn { color: var(--warn); } .danger { color: var(--danger); }
</style>
```

- [ ] **Step 3: IconButton**

Create `app/components/ui/IconButton.vue`:
```vue
<script setup lang="ts">
defineProps<{ active?: boolean; title?: string }>()
</script>
<template>
  <button class="ib" :class="{ active }" :title="title"><slot /></button>
</template>
<style scoped>
.ib { display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  background: var(--bg-2); color: var(--text-dim); border: 1px solid var(--border);
  border-radius: var(--radius-m); padding: 8px 10px; cursor: pointer; transition: all var(--dur) var(--ease); }
.ib:hover { color: var(--text); border-color: var(--accent-dim); }
.ib.active { color: var(--accent); border-color: var(--accent); box-shadow: var(--shadow-glow); }
</style>
```

- [ ] **Step 4: EmptyState**

Create `app/components/ui/EmptyState.vue`:
```vue
<script setup lang="ts">
defineProps<{ title: string; hint?: string }>()
</script>
<template>
  <div class="empty">
    <h3>{{ title }}</h3>
    <p v-if="hint">{{ hint }}</p>
  </div>
</template>
<style scoped>
.empty { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 6px;
  align-items: center; justify-content: center; color: var(--text-faint); text-align: center; }
.empty h3 { color: var(--text-dim); margin: 0; font-weight: 600; }
.empty p { margin: 0; font-size: 13px; }
</style>
```

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add app/components/ui/Panel.vue app/components/ui/Badge.vue app/components/ui/IconButton.vue app/components/ui/EmptyState.vue
git commit -m "feat: Control Room UI primitives"
```

---

## Task 12: View state in the store

**Files:** Modify `app/stores/graph.ts`

- [ ] **Step 1: Add view state and persistence**

Edit `app/stores/graph.ts`. Add inside the store setup (after the existing refs), and include the new members in the returned object:
```ts
  type ViewId = 'map' | 'webhooks' | 'schedules'
  const view = ref<ViewId>('map')
  const layers = ref<{ credentials: boolean; nodeTypes: boolean }>({ credentials: false, nodeTypes: false })

  if (import.meta.client) {
    const saved = localStorage.getItem('n8nviz.prefs')
    if (saved) {
      try {
        const p = JSON.parse(saved)
        if (p.view) view.value = p.view
        if (p.layers) layers.value = p.layers
        if (p.linkTypes) linkTypes.value = p.linkTypes
        if (p.tagFilter) tagFilter.value = p.tagFilter
      } catch { /* ignore corrupt prefs */ }
    }
    watch([view, layers, linkTypes, tagFilter], () => {
      localStorage.setItem('n8nviz.prefs', JSON.stringify({
        view: view.value, layers: layers.value, linkTypes: linkTypes.value, tagFilter: tagFilter.value,
      }))
    }, { deep: true })
  }
```
Add `view, layers` to the `return { ... }`. (`watch` is auto-imported in Nuxt.)

- [ ] **Step 2: Verify build**

Run: `bun run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/stores/graph.ts
git commit -m "feat: persisted view + layer state in store"
```

---

## Task 13: Map layers composable

**Files:** Create `app/composables/useMapLayers.ts`, `app/composables/useMapLayers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/composables/useMapLayers.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { overlayNodesAndEdges } from './useMapLayers'
import type { WorkflowGraph } from '#shared/types/graph'

const graph: WorkflowGraph = {
  nodes: [{ id: 'w', name: 'W', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
    summary: { nodeCount: 1, nodeTypes: [{ type: 'n8n-nodes-base.set', displayName: 'Set', count: 1 }], credentials: ['My API'], inbound: 0, outbound: 0 } }],
  edges: [], unresolved: [], skipped: [],
  webhooks: [], schedules: [],
  credentials: [{ id: '1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['w'] }],
}
const basePos = new Map([['w', { x: 0, y: 0 }]])

describe('overlayNodesAndEdges', () => {
  it('adds nothing when both layers are off', () => {
    const r = overlayNodesAndEdges(graph, basePos, { credentials: false, nodeTypes: false })
    expect(r.nodes).toEqual([])
    expect(r.edges).toEqual([])
  })

  it('adds a credential node + uses edge when credentials layer on', () => {
    const r = overlayNodesAndEdges(graph, basePos, { credentials: true, nodeTypes: false })
    expect(r.nodes.some(n => n.kind === 'credential' && n.label === 'My API')).toBe(true)
    expect(r.edges.some(e => e.source === 'w' && e.target.includes('My API'))).toBe(true)
  })

  it('adds a node-type node + contains edge when nodeTypes layer on', () => {
    const r = overlayNodesAndEdges(graph, basePos, { credentials: false, nodeTypes: true })
    expect(r.nodes.some(n => n.kind === 'nodeType' && n.label === 'Set')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- app/composables/useMapLayers.test.ts`
Expected: FAIL — cannot find module `./useMapLayers`.

- [ ] **Step 3: Write the implementation**

Create `app/composables/useMapLayers.ts`:
```ts
import type { WorkflowGraph } from '#shared/types/graph'

export interface OverlayNode { id: string; kind: 'credential' | 'nodeType'; label: string; x: number; y: number }
export interface OverlayEdge { id: string; source: string; target: string; kind: 'uses' | 'contains' }
export interface Point { x: number; y: number }

export function overlayNodesAndEdges(
  graph: WorkflowGraph,
  basePos: Map<string, Point>,
  layers: { credentials: boolean; nodeTypes: boolean },
): { nodes: OverlayNode[]; edges: OverlayEdge[] } {
  const nodes: OverlayNode[] = []
  const edges: OverlayEdge[] = []
  const seen = new Set<string>()

  const place = (parentId: string, i: number): Point => {
    const p = basePos.get(parentId) ?? { x: 0, y: 0 }
    const angle = (i % 8) * (Math.PI / 4)
    return { x: p.x + Math.cos(angle) * 90, y: p.y + Math.sin(angle) * 90 }
  }

  if (layers.credentials) {
    for (const c of graph.credentials) {
      const id = `cred:${c.type}:${c.id ?? c.name}`
      if (!seen.has(id)) {
        const pos = place(c.workflowIds[0] ?? '', nodes.length)
        nodes.push({ id, kind: 'credential', label: c.name, x: pos.x, y: pos.y })
        seen.add(id)
      }
      for (const wfId of c.workflowIds) edges.push({ id: `e:${wfId}:${id}`, source: wfId, target: id, kind: 'uses' })
    }
  }

  if (layers.nodeTypes) {
    for (const n of graph.nodes) {
      for (const t of n.summary.nodeTypes) {
        const id = `type:${t.type}`
        if (!seen.has(id)) {
          const pos = place(n.id, nodes.length)
          nodes.push({ id, kind: 'nodeType', label: t.displayName, x: pos.x, y: pos.y })
          seen.add(id)
        }
        edges.push({ id: `e:${n.id}:${id}`, source: n.id, target: id, kind: 'contains' })
      }
    }
  }

  return { nodes, edges }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- app/composables/useMapLayers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useMapLayers.ts app/composables/useMapLayers.test.ts
git commit -m "feat: map overlay layer projection (credentials, node types)"
```

---

## Task 14: Restyle node card + overlay node rendering

**Files:** Modify `app/components/WorkflowNodeCard.vue`, `app/components/WorkflowNodeCard.spec.ts`

- [ ] **Step 1: Update the spec for the new kinds**

Replace `app/components/WorkflowNodeCard.spec.ts` with:
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowNodeCard from './WorkflowNodeCard.vue'

const stubs = { Handle: { template: '<div />' } }   // Vue Flow Handle needs a provider; stub in unit test

describe('WorkflowNodeCard', () => {
  it('renders a workflow node with name + trigger icon', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { kind: 'workflow', label: 'Order Flow', triggers: ['webhook'], inbound: 3, dimmed: false } }, global: { stubs } })
    expect(w.text()).toContain('Order Flow')
    expect(w.find('[data-trigger="webhook"]').exists()).toBe(true)
  })

  it('renders a credential node with a distinct kind class', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { kind: 'credential', label: 'My API', triggers: [], inbound: 0, dimmed: false } }, global: { stubs } })
    expect(w.text()).toContain('My API')
    expect(w.find('.kind-credential').exists()).toBe(true)
  })

  it('applies dimmed class', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { kind: 'workflow', label: 'X', triggers: [], inbound: 0, dimmed: true } }, global: { stubs } })
    expect(w.classes()).toContain('dimmed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- app/components/WorkflowNodeCard.spec.ts`
Expected: FAIL — no `.kind-credential` / new `kind` prop handling.

- [ ] **Step 3: Update the component**

Replace `app/components/WorkflowNodeCard.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { TriggerType } from '#shared/types/graph'

type Kind = 'workflow' | 'credential' | 'nodeType'
const props = defineProps<{
  data: { kind: Kind; label: string; triggers: TriggerType[]; inbound: number; dimmed: boolean }
}>()

const icons: Record<TriggerType, string> = { webhook: '⚡', schedule: '⏰', manual: '▶', app: '🧩', unknown: '•' }
const kindIcon: Record<Kind, string> = { workflow: '', credential: '🔑', nodeType: '◆' }
const size = computed(() => 36 + Math.min(props.data.inbound, 12) * 6)
</script>

<template>
  <div class="node" :class="[`kind-${data.kind}`, { dimmed: data.dimmed }]" :style="{ minWidth: size + 'px' }">
    <Handle type="target" :position="Position.Left" />
    <span v-if="kindIcon[data.kind]" class="kindico">{{ kindIcon[data.kind] }}</span>
    <span v-for="t in data.triggers" :key="t" class="ico" :data-trigger="t">{{ icons[t] }}</span>
    <span class="label">{{ data.label }}</span>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.node { display: flex; align-items: center; gap: 6px; padding: 8px 12px; font-size: 13px;
  border: 1px solid var(--border); border-radius: var(--radius-m); background: var(--bg-3); color: var(--text);
  box-shadow: var(--shadow-1); transition: box-shadow var(--dur) var(--ease), opacity var(--dur) var(--ease); }
.node:hover { box-shadow: var(--shadow-glow); }
.node.dimmed { opacity: 0.22; }
.kind-credential { border-color: var(--warn); border-radius: 999px; }
.kind-nodeType { border-style: dashed; border-color: var(--link); }
.label { font-weight: 600; }
.kindico { opacity: .85; }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- app/components/WorkflowNodeCard.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/components/WorkflowNodeCard.vue app/components/WorkflowNodeCard.spec.ts
git commit -m "feat: restyle node card and support credential/node-type kinds"
```

---

## Task 15: Wire layers into the Map + restyle side panel

**Files:** Modify `app/components/WorkflowMap.vue`, `app/components/SidePanel.vue`, `app/components/SidePanel.spec.ts`

- [ ] **Step 1: Add overlay layers to the map**

Edit `app/components/WorkflowMap.vue`. Import the overlay helper and the store layers, then merge overlay nodes/edges into the computed lists. Add near the other imports:
```ts
import { overlayNodesAndEdges } from '~/composables/useMapLayers'
```
Replace the `nodes` computed body so workflow nodes carry `kind: 'workflow'`, and append overlay nodes:
```ts
const positions = computed(() => store.graph ? computeLayout(store.graph) : new Map<string, { x: number; y: number }>())

const nodes = computed<Node[]>(() => {
  const g = store.graph
  if (!g) return []
  const pos = positions.value
  const base: Node[] = g.nodes.map(n => ({
    id: n.id, type: 'workflow', position: pos.get(n.id) ?? { x: 0, y: 0 },
    data: { kind: 'workflow', label: n.name, triggers: n.triggers, inbound: n.summary.inbound, dimmed: !matchesTags(n, store.tagFilter) },
  }))
  const overlay = overlayNodesAndEdges(g, pos, store.layers)
  const overlayNodes: Node[] = overlay.nodes.map(o => ({
    id: o.id, type: 'workflow', position: { x: o.x, y: o.y },
    data: { kind: o.kind, label: o.label, triggers: [], inbound: 0, dimmed: false },
  }))
  return [...base, ...overlayNodes]
})
```
Append overlay edges in the `edges` computed:
```ts
const edges = computed<Edge[]>(() => {
  const g = store.graph
  if (!g) return []
  const baseEdges: Edge[] = g.edges.filter(e => store.linkTypes[e.type]).map(e => ({
    id: `${e.source}|${e.target}|${e.type}`, source: e.source, target: e.target,
    animated: e.type === 'webhookHttp', style: edgeStyle[e.type],
  }))
  const overlay = overlayNodesAndEdges(g, positions.value, store.layers)
  const overlayEdges: Edge[] = overlay.edges.map(o => ({
    id: o.id, source: o.source, target: o.target,
    style: { stroke: o.kind === 'uses' ? '#ffb454' : '#6aa0ff', strokeDasharray: '4 4', opacity: 0.6 },
  }))
  return [...baseEdges, ...overlayEdges]
})
```

- [ ] **Step 2: Restyle the side panel and show readable node types**

Update `app/components/SidePanel.spec.ts` fixture + assertion to use the new `nodeTypes` shape (`displayName`) and expect the readable name:
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SidePanel from './SidePanel.vue'
import type { WorkflowNode } from '#shared/types/graph'

const node: WorkflowNode = {
  id: 'a', name: 'Order Flow', active: true, triggers: ['webhook'], tags: ['prod'],
  webhookPaths: ['orders'], deepLink: 'https://n8n.example.com/workflow/a',
  summary: { nodeCount: 3, nodeTypes: [{ type: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request', count: 2 }], credentials: ['My API'], inbound: 1, outbound: 0 },
}

describe('SidePanel', () => {
  it('shows readable node-type names and a deep link', () => {
    const w = mount(SidePanel, { props: { node } })
    expect(w.text()).toContain('Order Flow')
    expect(w.text()).toContain('HTTP Request')
    expect(w.text()).not.toContain('n8n-nodes-base.httpRequest')
    expect(w.find('a.deep-link').attributes('href')).toBe('https://n8n.example.com/workflow/a')
  })
  it('hides the deep link when null', () => {
    const w = mount(SidePanel, { props: { node: { ...node, deepLink: null } } })
    expect(w.find('a.deep-link').exists()).toBe(false)
  })
})
```
Run it red: `bun run test -- app/components/SidePanel.spec.ts` (the node-types `<li>` currently prints `nt.type`).

Then edit `app/components/SidePanel.vue`: change the node-types list to render `nt.displayName` and restyle with tokens. Replace the Nodes `<section>` list line:
```vue
      <ul><li v-for="nt in node.summary.nodeTypes" :key="nt.type">{{ nt.count }}× {{ nt.displayName }}</li></ul>
```
And update the `<style scoped>` block to use tokens (background `var(--bg-2)`, border `var(--border)`, text `var(--text)`; badges use `var(--bg-3)`/`var(--accent)`). Keep the `a.deep-link` class and structure intact.

- [ ] **Step 3: Run the side-panel test**

Run: `bun run test -- app/components/SidePanel.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 4: Build check**

Run: `bun run build`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/components/WorkflowMap.vue app/components/SidePanel.vue app/components/SidePanel.spec.ts
git commit -m "feat: map overlay layers + readable types in restyled side panel"
```

---

# PHASE 3 — Webhooks & Schedules views

## Task 16: DataTable primitive

**Files:** Create `app/components/ui/DataTable.vue`, `app/components/ui/DataTable.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `app/components/ui/DataTable.spec.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DataTable from './DataTable.vue'

const columns = [{ key: 'name', label: 'Name' }, { key: 'count', label: 'Count' }]
const rows = [{ name: 'Beta', count: 2 }, { name: 'Alpha', count: 5 }]

describe('DataTable', () => {
  it('renders headers and rows', () => {
    const w = mount(DataTable, { props: { columns, rows } })
    expect(w.text()).toContain('Name')
    expect(w.findAll('tbody tr')).toHaveLength(2)
  })

  it('sorts ascending when a header is clicked', async () => {
    const w = mount(DataTable, { props: { columns, rows } })
    await w.findAll('th')[0].trigger('click')
    expect(w.findAll('tbody tr')[0].text()).toContain('Alpha')
  })

  it('filters rows by the filter prop', () => {
    const w = mount(DataTable, { props: { columns, rows, filter: 'alph' } })
    expect(w.findAll('tbody tr')).toHaveLength(1)
    expect(w.text()).toContain('Alpha')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- app/components/ui/DataTable.spec.ts`
Expected: FAIL — component missing.

- [ ] **Step 3: Write the component**

Create `app/components/ui/DataTable.vue`:
```vue
<script setup lang="ts">
import { computed, ref } from 'vue'

interface Column { key: string; label: string }
const props = defineProps<{ columns: Column[]; rows: Record<string, any>[]; filter?: string }>()
defineEmits<{ rowClick: [row: Record<string, any>] }>()

const sortKey = ref<string | null>(null)
const sortDir = ref<1 | -1>(1)

function toggleSort(key: string) {
  if (sortKey.value === key) sortDir.value = (sortDir.value === 1 ? -1 : 1)
  else { sortKey.value = key; sortDir.value = 1 }
}

const view = computed(() => {
  const f = (props.filter ?? '').trim().toLowerCase()
  let r = props.rows
  if (f) r = r.filter(row => props.columns.some(c => String(row[c.key] ?? '').toLowerCase().includes(f)))
  if (sortKey.value) {
    const k = sortKey.value
    r = [...r].sort((a, b) => String(a[k] ?? '').localeCompare(String(b[k] ?? ''), undefined, { numeric: true }) * sortDir.value)
  }
  return r
})
</script>

<template>
  <table class="dt">
    <thead>
      <tr>
        <th v-for="c in columns" :key="c.key" @click="toggleSort(c.key)">
          {{ c.label }}<span v-if="sortKey === c.key">{{ sortDir === 1 ? ' ▲' : ' ▼' }}</span>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, i) in view" :key="i" @click="$emit('rowClick', row)">
        <td v-for="c in columns" :key="c.key"><slot :name="`cell-${c.key}`" :row="row">{{ row[c.key] }}</slot></td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.dt { width: 100%; border-collapse: collapse; font-size: 13px; color: var(--text); }
thead th { text-align: left; padding: 8px 10px; background: var(--bg-2); color: var(--text-dim);
  font-size: 11px; text-transform: uppercase; letter-spacing: .04em; cursor: pointer; user-select: none;
  position: sticky; top: 0; }
tbody td { padding: 8px 10px; border-top: 1px solid var(--border-soft); }
tbody tr { cursor: pointer; transition: background var(--dur) var(--ease); }
tbody tr:hover { background: var(--bg-2); }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- app/components/ui/DataTable.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/components/ui/DataTable.vue app/components/ui/DataTable.spec.ts
git commit -m "feat: sortable filterable DataTable primitive"
```

---

## Task 17: Webhook view composable

**Files:** Create `app/composables/useWebhookView.ts`, `app/composables/useWebhookView.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/composables/useWebhookView.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { webhookRows, callersOf } from './useWebhookView'
import type { WorkflowGraph } from '#shared/types/graph'

const graph: WorkflowGraph = {
  nodes: [
    { id: 'p', name: 'Producer', active: true, triggers: ['webhook'], tags: [], webhookPaths: ['orders'], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 1, outbound: 0 } },
    { id: 'c', name: 'Consumer', active: false, triggers: [], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 1 } },
  ],
  edges: [{ source: 'c', target: 'p', type: 'webhookHttp' }],
  unresolved: [], skipped: [],
  webhooks: [{ workflowId: 'p', method: 'POST', path: 'orders', prodUrl: 'https://h/webhook/orders', testUrl: 'https://h/webhook-test/orders' }],
  schedules: [], credentials: [],
}

describe('webhookRows', () => {
  it('joins each webhook to its workflow name and active state', () => {
    const rows = webhookRows(graph)
    expect(rows[0]).toMatchObject({ workflowId: 'p', workflow: 'Producer', method: 'POST', url: 'https://h/webhook/orders', active: true })
  })
})

describe('callersOf', () => {
  it('lists workflows that call a webhook owner via HTTP', () => {
    expect(callersOf(graph, 'p')).toEqual([{ id: 'c', name: 'Consumer' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- app/composables/useWebhookView.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

Create `app/composables/useWebhookView.ts`:
```ts
import type { WorkflowGraph } from '#shared/types/graph'

export interface WebhookRow {
  workflowId: string; workflow: string; method: string; path: string; url: string; active: boolean
}

export function webhookRows(graph: WorkflowGraph | null): WebhookRow[] {
  if (!graph) return []
  const nameById = new Map(graph.nodes.map(n => [n.id, n]))
  return graph.webhooks.map(w => {
    const wf = nameById.get(w.workflowId)
    return {
      workflowId: w.workflowId,
      workflow: wf?.name ?? w.workflowId,
      method: w.method,
      path: w.path,
      url: w.prodUrl ?? `/webhook/${w.path}`,
      active: wf?.active ?? false,
    }
  })
}

export function callersOf(graph: WorkflowGraph | null, ownerId: string): { id: string; name: string }[] {
  if (!graph) return []
  const nameById = new Map(graph.nodes.map(n => [n.id, n.name]))
  return graph.edges
    .filter(e => e.type === 'webhookHttp' && e.target === ownerId)
    .map(e => ({ id: e.source, name: nameById.get(e.source) ?? e.source }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- app/composables/useWebhookView.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useWebhookView.ts app/composables/useWebhookView.test.ts
git commit -m "feat: webhook view projection + caller lookup"
```

---

## Task 18: Webhooks view component

**Files:** Create `app/components/WebhooksView.vue`

Verified by build + the final e2e (Task 21). Thin glue over `DataTable` + `useWebhookView`.

- [ ] **Step 1: Write the component**

Create `app/components/WebhooksView.vue`:
```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { webhookRows, callersOf } from '~/composables/useWebhookView'

const store = useGraphStore()
const filter = ref('')
const expanded = ref<string | null>(null)

const columns = [
  { key: 'method', label: 'Method' },
  { key: 'url', label: 'URL' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'active', label: 'State' },
]
const rows = computed(() => webhookRows(store.graph))

function jump(row: { workflowId: string }) { store.selectedId = row.workflowId; store.view = 'map' }
function copy(url: string) { if (import.meta.client) navigator.clipboard?.writeText(url) }
function toggle(id: string) { expanded.value = expanded.value === id ? null : id }
</script>

<template>
  <div class="wrap">
    <div class="bar"><input v-model="filter" class="search" placeholder="Filter webhooks…" /></div>
    <DataTable :columns="columns" :rows="rows" :filter="filter">
      <template #cell-method="{ row }"><Badge :tone="row.method === 'POST' ? 'accent' : 'warn'">{{ row.method }}</Badge></template>
      <template #cell-url="{ row }">
        <code class="url" @click.stop="copy(row.url)" :title="'Click to copy: ' + row.url">{{ row.url }}</code>
        <button class="callers" @click.stop="toggle(row.workflowId)">callers</button>
        <ul v-if="expanded === row.workflowId" class="callerlist">
          <li v-for="c in callersOf(store.graph, row.workflowId)" :key="c.id">↳ {{ c.name }}</li>
          <li v-if="!callersOf(store.graph, row.workflowId).length" class="none">no internal callers</li>
        </ul>
      </template>
      <template #cell-workflow="{ row }"><a class="wf" @click.stop="jump(row)">{{ row.workflow }}</a></template>
      <template #cell-active="{ row }"><span :class="row.active ? 'on' : 'off'">●</span></template>
    </DataTable>
    <EmptyState v-if="!rows.length" title="No webhooks" hint="No webhook triggers found in this instance." />
  </div>
</template>

<style scoped>
.wrap { position: relative; height: 100%; overflow: auto; padding: 12px; }
.bar { margin-bottom: 10px; }
.search { width: 280px; background: var(--bg-2); border: 1px solid var(--border); color: var(--text);
  border-radius: var(--radius-m); padding: 8px 10px; }
.url { font-family: var(--font-mono); color: var(--link); cursor: pointer; }
.callers { margin-left: 8px; font-size: 11px; background: none; border: 1px solid var(--border);
  color: var(--text-dim); border-radius: var(--radius-s); cursor: pointer; padding: 1px 6px; }
.callerlist { margin: 6px 0 0; padding-left: 14px; color: var(--text-dim); font-size: 12px; }
.callerlist .none { color: var(--text-faint); }
.wf { color: var(--accent); cursor: pointer; }
.on { color: var(--accent); } .off { color: var(--text-faint); }
</style>
```

- [ ] **Step 2: Build check**

Run: `bun run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/components/WebhooksView.vue
git commit -m "feat: Webhooks view (URL table + callers)"
```

---

## Task 19: Schedule view composable

**Files:** Create `app/composables/useScheduleView.ts`, `app/composables/useScheduleView.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/composables/useScheduleView.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { scheduleGroups, formatCountdown } from './useScheduleView'
import type { WorkflowGraph } from '#shared/types/graph'

const graph: WorkflowGraph = {
  nodes: [
    { id: 'a', name: 'Nightly', active: true, triggers: ['schedule'], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 } },
    { id: 'b', name: 'Poller', active: true, triggers: ['schedule'], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 } },
  ],
  edges: [], unresolved: [], skipped: [], webhooks: [], credentials: [],
  schedules: [
    { workflowId: 'a', cadenceText: 'Every day at 02:00', cadenceGroup: 'daily', nextFire: '2026-06-09T02:00:00.000Z' },
    { workflowId: 'b', cadenceText: 'Every 15 minutes', cadenceGroup: 'minutes', nextFire: '2026-06-08T02:15:00.000Z' },
  ],
}

describe('scheduleGroups', () => {
  it('orders groups coarse-to-fine and joins workflow names', () => {
    const groups = scheduleGroups(graph)
    expect(groups.map(g => g.group)).toEqual(['minutes', 'daily'])
    expect(groups[0].rows[0]).toMatchObject({ workflow: 'Poller', cadenceText: 'Every 15 minutes' })
  })
})

describe('formatCountdown', () => {
  it('formats a positive delta', () => {
    expect(formatCountdown('2026-06-08T02:15:00.000Z', '2026-06-08T02:00:00.000Z')).toBe('in 15m')
  })
  it('handles null nextFire', () => {
    expect(formatCountdown(null, '2026-06-08T02:00:00.000Z')).toBe('—')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- app/composables/useScheduleView.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation**

Create `app/composables/useScheduleView.ts`:
```ts
import type { WorkflowGraph, CadenceGroup } from '#shared/types/graph'

const ORDER: CadenceGroup[] = ['sub-minute', 'minutes', 'hourly', 'daily', 'weekly', 'monthly', 'cron']

export interface ScheduleRow { workflowId: string; workflow: string; cadenceText: string; nextFire: string | null; active: boolean }
export interface ScheduleGroupView { group: CadenceGroup; rows: ScheduleRow[] }

export function scheduleGroups(graph: WorkflowGraph | null): ScheduleGroupView[] {
  if (!graph) return []
  const nameById = new Map(graph.nodes.map(n => [n.id, n]))
  const byGroup = new Map<CadenceGroup, ScheduleRow[]>()
  for (const s of graph.schedules) {
    const wf = nameById.get(s.workflowId)
    const row: ScheduleRow = { workflowId: s.workflowId, workflow: wf?.name ?? s.workflowId, cadenceText: s.cadenceText, nextFire: s.nextFire, active: wf?.active ?? false }
    const list = byGroup.get(s.cadenceGroup) ?? []
    list.push(row)
    byGroup.set(s.cadenceGroup, list)
  }
  return ORDER.filter(g => byGroup.has(g)).map(g => ({ group: g, rows: byGroup.get(g)! }))
}

export function formatCountdown(nextFire: string | null, now: string): string {
  if (!nextFire) return '—'
  const delta = new Date(nextFire).getTime() - new Date(now).getTime()
  if (delta <= 0) return 'due'
  const mins = Math.round(delta / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `in ${hrs}h ${mins % 60}m`
  return `in ${Math.floor(hrs / 24)}d ${hrs % 24}h`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- app/composables/useScheduleView.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useScheduleView.ts app/composables/useScheduleView.test.ts
git commit -m "feat: schedule view grouping + countdown formatting"
```

---

## Task 20: Schedules view component

**Files:** Create `app/components/SchedulesView.vue`

Verified by build + final e2e. Thin glue over `useScheduleView`.

- [ ] **Step 1: Write the component**

Create `app/components/SchedulesView.vue`:
```vue
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { scheduleGroups, formatCountdown } from '~/composables/useScheduleView'

const store = useGraphStore()
const filter = ref('')
const activeOnly = ref(false)
const now = ref(new Date().toISOString())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => { timer = setInterval(() => { now.value = new Date().toISOString() }, 30000) })
onUnmounted(() => clearInterval(timer))

const groups = computed(() => {
  const base = scheduleGroups(store.graph)
  const f = filter.value.trim().toLowerCase()
  return base
    .map(g => ({ group: g.group, rows: g.rows.filter(r =>
      (!activeOnly.value || r.active) && (!f || r.workflow.toLowerCase().includes(f) || r.cadenceText.toLowerCase().includes(f))) }))
    .filter(g => g.rows.length)
})
const labels: Record<string, string> = {
  'sub-minute': 'Sub-minute', minutes: 'Minutes', hourly: 'Hourly',
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', cron: 'Custom cron',
}
function jump(id: string) { store.selectedId = id; store.view = 'map' }
</script>

<template>
  <div class="wrap">
    <div class="bar">
      <input v-model="filter" class="search" placeholder="Filter schedules…" />
      <label class="chk"><input type="checkbox" v-model="activeOnly" /> active only</label>
    </div>
    <div v-for="g in groups" :key="g.group" class="group">
      <div class="ghead">{{ labels[g.group] }}</div>
      <Panel>
        <div v-for="r in g.rows" :key="r.workflowId + r.cadenceText" class="row" @click="jump(r.workflowId)">
          <span class="dot" :class="r.active ? 'on' : 'off'">●</span>
          <span class="wf">{{ r.workflow }}</span>
          <span class="cadence">{{ r.cadenceText }}</span>
          <span class="next">{{ formatCountdown(r.nextFire, now) }}</span>
        </div>
      </Panel>
    </div>
    <EmptyState v-if="!groups.length" title="No schedules" hint="No schedule or cron triggers found." />
  </div>
</template>

<style scoped>
.wrap { position: relative; height: 100%; overflow: auto; padding: 12px; }
.bar { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
.search { width: 280px; background: var(--bg-2); border: 1px solid var(--border); color: var(--text);
  border-radius: var(--radius-m); padding: 8px 10px; }
.chk { color: var(--text-dim); font-size: 13px; }
.group { margin-bottom: 16px; }
.ghead { color: var(--text-dim); text-transform: uppercase; font-size: 11px; letter-spacing: .05em; margin: 0 0 6px 4px; }
.row { display: grid; grid-template-columns: 18px 1fr 1fr 90px; gap: 10px; align-items: center;
  padding: 10px 12px; border-bottom: 1px solid var(--border-soft); cursor: pointer; transition: background var(--dur) var(--ease); }
.row:last-child { border-bottom: none; }
.row:hover { background: var(--bg-3); }
.dot.on { color: var(--accent); } .dot.off { color: var(--text-faint); }
.wf { font-weight: 600; }
.cadence { color: var(--text-dim); }
.next { color: var(--accent); text-align: right; font-variant-numeric: tabular-nums; }
</style>
```

- [ ] **Step 2: Build check**

Run: `bun run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/components/SchedulesView.vue
git commit -m "feat: Schedules view (grouped cadence list with countdown)"
```

---

## Task 21: App shell + view switching + end-to-end

**Files:** Create `app/components/AppShell.vue`, `app/components/MapLayerToggles.vue`; modify `app/pages/index.vue`

- [ ] **Step 1: Write the layer toggles**

Create `app/components/MapLayerToggles.vue`:
```vue
<script setup lang="ts">
import { useGraphStore } from '~/stores/graph'
const store = useGraphStore()
</script>
<template>
  <div class="toggles">
    <IconButton :active="store.layers.credentials" title="Toggle credential nodes"
      @click="store.layers.credentials = !store.layers.credentials">🔑 Credentials</IconButton>
    <IconButton :active="store.layers.nodeTypes" title="Toggle node-type nodes"
      @click="store.layers.nodeTypes = !store.layers.nodeTypes">◆ Node types</IconButton>
  </div>
</template>
<style scoped>.toggles { display: flex; gap: 8px; }</style>
```

- [ ] **Step 2: Write the app shell**

Create `app/components/AppShell.vue`:
```vue
<script setup lang="ts">
import { useGraphStore } from '~/stores/graph'
const store = useGraphStore()
const views = [
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'webhooks', icon: '🔗', label: 'Webhooks' },
  { id: 'schedules', icon: '⏰', label: 'Schedules' },
] as const
</script>
<template>
  <div class="shell">
    <nav class="rail">
      <div class="brand">n8n</div>
      <button v-for="v in views" :key="v.id" class="navbtn" :class="{ active: store.view === v.id }"
        :title="v.label" @click="store.view = v.id">
        <span class="i">{{ v.icon }}</span><span class="t">{{ v.label }}</span>
      </button>
    </nav>
    <div class="main">
      <header class="topbar">
        <slot name="topbar" />
        <div class="spacer" />
        <MapLayerToggles v-if="store.view === 'map' && store.graph" />
      </header>
      <div class="body"><slot /></div>
    </div>
  </div>
</template>
<style scoped>
.shell { display: flex; height: 100vh; }
.rail { width: 76px; background: var(--bg-1); border-right: 1px solid var(--border); display: flex;
  flex-direction: column; align-items: stretch; padding: 12px 8px; gap: 6px; }
.brand { color: var(--accent); font-weight: 800; text-align: center; margin-bottom: 10px; letter-spacing: .04em; }
.navbtn { display: flex; flex-direction: column; align-items: center; gap: 2px; background: none; border: none;
  color: var(--text-faint); cursor: pointer; padding: 8px 4px; border-radius: var(--radius-m); transition: all var(--dur) var(--ease); }
.navbtn .i { font-size: 18px; } .navbtn .t { font-size: 10px; }
.navbtn:hover { color: var(--text-dim); background: var(--bg-2); }
.navbtn.active { color: var(--accent); background: var(--bg-2); box-shadow: inset 2px 0 0 var(--accent); }
.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.topbar { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--border);
  background: var(--bg-1); }
.spacer { flex: 1; }
.body { position: relative; flex: 1; min-height: 0; }
</style>
```

- [ ] **Step 3: Rewrite the page to switch views**

Replace `app/pages/index.vue`:
```vue
<script setup lang="ts">
import { useGraphStore } from '~/stores/graph'
const store = useGraphStore()
</script>

<template>
  <AppShell>
    <template #topbar><Toolbar /></template>

    <ClientOnly>
      <WorkflowMap v-if="store.view === 'map' && store.graph" />
      <WebhooksView v-else-if="store.view === 'webhooks' && store.graph" />
      <SchedulesView v-else-if="store.view === 'schedules' && store.graph" />
    </ClientOnly>

    <EmptyState v-if="!store.graph && !store.loading"
      title="Connect an n8n instance or upload workflow JSON"
      hint="Use the bar above to load via API or drop a workflow export." />
    <EmptyState v-if="store.loading" title="Loading…" />

    <SidePanel v-if="store.selected && store.view === 'map'" :node="store.selected" @close="store.selectedId = null" />
  </AppShell>
</template>
```
Note: `Toolbar` is the existing connect/search/filter component; it now lives in the top bar. Its own outer padding/border may double up with the topbar — trim Toolbar's `.toolbar` border-bottom if it looks heavy (cosmetic, optional).

- [ ] **Step 4: Full suite**

Run: `bun run test`
Expected: all pass (v1 + all v2 unit tests). Report the count.

- [ ] **Step 5: Build**

Run: `bun run build`
Expected: clean.

- [ ] **Step 6: End-to-end check**

Run:
```bash
TMPDIR=/tmp bun run dev > /tmp/v2-e2e.log 2>&1 &
DEV=$!
for i in $(seq 1 30); do curl -s http://localhost:3000/ >/dev/null 2>&1 && break; sleep 1; done
curl -s -o /dev/null -w "index=%{http_code}\n" http://localhost:3000/
curl -s -X POST http://localhost:3000/api/ingest/upload -H 'content-type: application/json' \
  -d '{"baseUrl":"https://n8n.example.com","workflows":[
    {"id":"A","name":"Producer","active":true,"nodes":[
      {"name":"hook","type":"n8n-nodes-base.webhook","parameters":{"path":"orders","httpMethod":"POST"}},
      {"name":"s","type":"n8n-nodes-base.scheduleTrigger","parameters":{"rule":{"interval":[{"field":"days","daysInterval":1,"triggerAtHour":2,"triggerAtMinute":0}]}}},
      {"name":"h","type":"n8n-nodes-base.httpRequest","credentials":{"httpHeaderAuth":{"id":"1","name":"My API"}}}
    ]}
  ]}' | head -c 600
echo; kill $DEV 2>/dev/null
```
Expected: `index=200`; the JSON has non-empty `webhooks`, `schedules` (with `cadenceText`/`nextFire`), `credentials`, and node `summary.nodeTypes[].displayName`. Note that the visual/interaction checks (switching views in the rail, layer toggles, copy-URL, countdown) remain for manual human verification — report this.

- [ ] **Step 7: Commit**

```bash
git add app/components/AppShell.vue app/components/MapLayerToggles.vue app/pages/index.vue
git commit -m "feat: app shell with view switching and layer controls"
```

---

## Self-Review Notes

- **Spec coverage:** Control Room tokens + primitives (T10–11), icon-rail shell + persistence (T12, T21), readable node types via layered catalog (T2–4, enriched T9, shown T15), webhook URLs+methods (T5), schedules parse + next-fire (T6–7), credentials (T8), graph enrichment + routes (T9), Map layer overlays credentials/node-types default-off (T13–15, T21 toggles), Webhooks table + callers + jump (T16–18), Schedules grouped list + countdown (T19–20), view switching (T21). All spec sections map to tasks.
- **Type consistency:** `NodeTypeCount` gains `displayName` (T1); `summarize` returns raw `{type,count}` and `buildGraph` enriches with `catalog.displayName` (T9); `WorkflowGraph` gains `webhooks/schedules/credentials` (T1) populated in T9 and consumed by T15/T17/T19. `CadenceGroup` enum shared by T1/T6/T19. `NodeCatalog`/`CatalogCache`/`CatalogSource` defined in T3, used in T4/T9.
- **v1 regressions handled:** `WorkflowNodeCard` prop gains `kind` (T14 updates its spec); `SidePanel` shows `displayName` (T15 updates its spec + fixture). `buildGraph`'s new 3rd arg is optional, so v1 build-graph.test's 2-arg calls still compile; v1 nodeTypes fixtures lack `displayName` but are runtime-only (esbuild strips types) — the assertions they make don't touch `displayName`.
- **Placeholder scan:** none. The one optional cosmetic note (Toolbar border trim in T21) is explicitly marked optional, not a required-but-vague step.
