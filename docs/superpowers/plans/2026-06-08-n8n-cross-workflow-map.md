# n8n Cross-Workflow Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-user local tool that ingests an n8n instance's workflows (via REST API or JSON upload) and renders a force-directed map of how workflows relate, with per-workflow detail, search, tag filtering, and deep links back to n8n.

**Architecture:** Three layers with clean boundaries. (1) **Ingest** — Nitro server routes normalize API/upload input to `RawWorkflow[]`. (2) **Parser** — pure TypeScript functions turn `RawWorkflow[]` into one `WorkflowGraph`; this is where the differentiating logic and the test coverage live. (3) **Viz** — Nuxt/Vue Flow client renders the graph from a Pinia store with precomputed d3-force layout.

**Tech Stack:** Bun, Nuxt 4 (Vue 3, TypeScript, Nitro), Vue Flow (`@vue-flow/core`), d3-force, Pinia, Vitest + @vue/test-utils.

---

## Nuxt 4 Path Convention (applied during execution)

The scaffold resolved to Nuxt 4, whose default `srcDir` is `app/`. Paths in the
tasks below were written Nuxt-3-style; apply this mapping when executing:

- **Shared domain types** live in `shared/types/graph.ts` and are imported as
  `#shared/types/graph` from **both** server and app code (the only alias valid
  in both contexts). Wherever a task shows `~/types/graph`, use
  `#shared/types/graph`.
- **App code** lives under `app/`: `app/components/`, `app/pages/`,
  `app/composables/`, `app/stores/`. Tests sit beside their source.
- **Server code** stays at `server/` (repo root).
- Inside app code, `~` resolves to `app/`, so imports like
  `~/composables/useForceLayout` and `~/stores/graph` are correct as written.
- `vitest.config.ts` aliases mirror this: `#shared`→`shared/`, `~`/`@`→`app/`,
  `~~`/`@@`→ root.

---

## File Structure

```
nuxt.config.ts                       # Nuxt config, Pinia + Vue Flow
vitest.config.ts                     # Vitest config
package.json / tsconfig.json
types/graph.ts                       # shared domain types (server + client)
server/ingest/normalize.ts           # raw JSON/array/bundle -> RawWorkflow[]
server/ingest/n8n-client.ts          # paginated fetch from n8n REST API
server/parser/triggers.ts            # classifyTriggers
server/parser/links.ts               # execute / error / webhook->http edges
server/parser/summarize.ts           # summarize, extractTags, extractWebhookPaths
server/parser/build-graph.ts         # orchestrator -> WorkflowGraph
server/api/ingest/api.post.ts        # POST /api/ingest/api
server/api/ingest/upload.post.ts     # POST /api/ingest/upload
stores/graph.ts                      # Pinia store (load + state)
composables/useForceLayout.ts        # d3-force precomputed positions
composables/useSearch.ts             # search over the graph
composables/useTagFilter.ts          # tag list + match predicate
components/WorkflowNodeCard.vue       # custom Vue Flow node
components/WorkflowMap.vue            # Vue Flow canvas + filter/focus wiring
components/SidePanel.vue             # selected-workflow detail + deep link
components/Toolbar.vue               # source switch, link filters, search, tags, unresolved badge
pages/index.vue                      # top-level wiring
```

Test files live next to their source as `*.test.ts` (parser/ingest/composables) or `*.spec.ts` (components).

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`, `nuxt.config.ts`, `tsconfig.json`, `vitest.config.ts`, `app.vue`

- [ ] **Step 1: Initialize Nuxt with Bun**

Run:
```bash
bun x nuxi@latest init . --packageManager bun --gitInit false --force
bun add @vue-flow/core @vue-flow/controls @vue-flow/background pinia @pinia/nuxt d3-force
bun add -d vitest @vue/test-utils happy-dom @types/d3-force
```

- [ ] **Step 2: Configure Nuxt modules**

Replace `nuxt.config.ts` with:
```ts
export default defineNuxtConfig({
  modules: ['@pinia/nuxt'],
  css: ['@vue-flow/core/dist/style.css', '@vue-flow/core/dist/theme-default.css'],
  typescript: { strict: true },
  devtools: { enabled: true },
})
```

- [ ] **Step 3: Add Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: { environment: 'happy-dom', globals: true },
  resolve: { alias: { '~': new URL('.', import.meta.url).pathname } },
})
```

Run: `bun add -d @vitejs/plugin-vue`

- [ ] **Step 4: Add test script**

In `package.json` `scripts`, add: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 5: Verify scaffold builds**

Run: `bun run build`
Expected: build completes without error.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Nuxt + Bun + Vue Flow + Vitest"
```

---

## Task 2: Shared domain types

**Files:**
- Create: `types/graph.ts`

- [ ] **Step 1: Write the types**

Create `types/graph.ts`:
```ts
export type TriggerType = 'webhook' | 'schedule' | 'manual' | 'app' | 'unknown'
export type LinkType = 'execute' | 'webhookHttp' | 'error'

export interface RawNode {
  id?: string
  name: string
  type: string
  parameters?: Record<string, any>
  credentials?: Record<string, { id?: string; name?: string }>
}

export interface RawWorkflow {
  id: string
  name: string
  active?: boolean
  nodes: RawNode[]
  connections?: Record<string, any>
  settings?: { errorWorkflow?: string; [k: string]: any }
  tags?: ({ id?: string; name: string } | string)[]
}

export interface NodeTypeCount { type: string; count: number }

export interface WorkflowSummary {
  nodeCount: number
  nodeTypes: NodeTypeCount[]
  credentials: string[]
  inbound: number
  outbound: number
}

export interface WorkflowNode {
  id: string
  name: string
  active: boolean
  triggers: TriggerType[]
  tags: string[]
  webhookPaths: string[]
  summary: WorkflowSummary
  deepLink: string | null
}

export interface WorkflowEdge { source: string; target: string; type: LinkType }
export interface UnresolvedLink { workflowId: string; nodeName: string; reason: string }
export interface SkippedWorkflow { name?: string; reason: string }

export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  unresolved: UnresolvedLink[]
  skipped: SkippedWorkflow[]
}
```

- [ ] **Step 2: Typecheck**

Run: `bun x vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/graph.ts
git commit -m "feat: add shared WorkflowGraph domain types"
```

---

## Task 3: Parser — trigger classification

**Files:**
- Create: `server/parser/triggers.ts`
- Test: `server/parser/triggers.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/parser/triggers.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { classifyTriggers } from './triggers'
import type { RawWorkflow } from '~/types/graph'

const wf = (nodes: { type: string }[]): RawWorkflow =>
  ({ id: 'w1', name: 'W', nodes: nodes.map((n, i) => ({ name: `n${i}`, type: n.type })) })

describe('classifyTriggers', () => {
  it('detects webhook, schedule, manual', () => {
    expect(classifyTriggers(wf([{ type: 'n8n-nodes-base.webhook' }]))).toEqual(['webhook'])
    expect(classifyTriggers(wf([{ type: 'n8n-nodes-base.scheduleTrigger' }]))).toEqual(['schedule'])
    expect(classifyTriggers(wf([{ type: 'n8n-nodes-base.manualTrigger' }]))).toEqual(['manual'])
  })

  it('treats other *Trigger nodes as app triggers', () => {
    expect(classifyTriggers(wf([{ type: 'n8n-nodes-base.slackTrigger' }]))).toEqual(['app'])
  })

  it('returns multiple distinct types and ignores non-trigger nodes', () => {
    const got = classifyTriggers(wf([
      { type: 'n8n-nodes-base.webhook' },
      { type: 'n8n-nodes-base.scheduleTrigger' },
      { type: 'n8n-nodes-base.set' },
    ]))
    expect(got.sort()).toEqual(['schedule', 'webhook'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- server/parser/triggers.test.ts`
Expected: FAIL — cannot find module `./triggers`.

- [ ] **Step 3: Write the implementation**

Create `server/parser/triggers.ts`:
```ts
import type { RawWorkflow, TriggerType } from '~/types/graph'

const SCHEDULE = new Set([
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.cron',
  'n8n-nodes-base.interval',
])

export function classifyTriggers(wf: RawWorkflow): TriggerType[] {
  const set = new Set<TriggerType>()
  for (const node of wf.nodes ?? []) {
    const t = node.type
    if (t === 'n8n-nodes-base.webhook') set.add('webhook')
    else if (SCHEDULE.has(t)) set.add('schedule')
    else if (t === 'n8n-nodes-base.manualTrigger') set.add('manual')
    else if (t.endsWith('Trigger')) set.add('app')
  }
  return [...set]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- server/parser/triggers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/parser/triggers.ts server/parser/triggers.test.ts
git commit -m "feat: classify workflow trigger types"
```

---

## Task 4: Parser — execute & error links

**Files:**
- Create: `server/parser/links.ts`
- Test: `server/parser/links.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/parser/links.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { extractExecuteLinks, extractErrorLink } from './links'
import type { RawWorkflow } from '~/types/graph'

describe('extractExecuteLinks', () => {
  it('reads target id from a string workflowId param', () => {
    const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [
      { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: 'b' } },
    ] }
    expect(extractExecuteLinks(wf)).toEqual([{ source: 'a', target: 'b', type: 'execute' }])
  })

  it('reads target id from a resource-locator object param', () => {
    const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [
      { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: { value: 'c', mode: 'list' } } },
    ] }
    expect(extractExecuteLinks(wf)).toEqual([{ source: 'a', target: 'c', type: 'execute' }])
  })

  it('ignores execute nodes with no resolvable target', () => {
    const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [
      { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: { value: '', mode: 'list' } } },
    ] }
    expect(extractExecuteLinks(wf)).toEqual([])
  })
})

describe('extractErrorLink', () => {
  it('builds an edge from settings.errorWorkflow', () => {
    const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [], settings: { errorWorkflow: 'eh' } }
    expect(extractErrorLink(wf)).toEqual({ source: 'a', target: 'eh', type: 'error' })
  })

  it('returns null when no error workflow is set', () => {
    expect(extractErrorLink({ id: 'a', name: 'A', nodes: [] })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- server/parser/links.test.ts`
Expected: FAIL — cannot find module `./links`.

- [ ] **Step 3: Write the implementation**

Create `server/parser/links.ts`:
```ts
import type { RawNode, RawWorkflow, WorkflowEdge, UnresolvedLink } from '~/types/graph'

function resolveWorkflowId(param: unknown): string | null {
  if (typeof param === 'string') return param || null
  if (param && typeof param === 'object' && 'value' in (param as any)) {
    const v = (param as any).value
    return typeof v === 'string' && v ? v : null
  }
  return null
}

export function extractExecuteLinks(wf: RawWorkflow): WorkflowEdge[] {
  const edges: WorkflowEdge[] = []
  for (const node of wf.nodes ?? []) {
    if (node.type !== 'n8n-nodes-base.executeWorkflow') continue
    const target = resolveWorkflowId(node.parameters?.workflowId)
    if (target) edges.push({ source: wf.id, target, type: 'execute' })
  }
  return edges
}

export function extractErrorLink(wf: RawWorkflow): WorkflowEdge | null {
  const target = wf.settings?.errorWorkflow
  return target ? { source: wf.id, target, type: 'error' } : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- server/parser/links.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add server/parser/links.ts server/parser/links.test.ts
git commit -m "feat: extract execute-workflow and error-workflow links"
```

---

## Task 5: Parser — webhook→HTTP links and unresolved detection

**Files:**
- Modify: `server/parser/links.ts`
- Modify: `server/parser/links.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `server/parser/links.test.ts`:
```ts
import { extractWebhookHttpLinks } from './links'

describe('extractWebhookHttpLinks', () => {
  const producer: RawWorkflow = { id: 'p', name: 'Producer', nodes: [
    { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'orders' } },
  ] }
  const consumer: RawWorkflow = { id: 'c', name: 'Consumer', nodes: [
    { name: 'http', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://n8n.example.com/webhook/orders' } },
  ] }

  it('links an HTTP node URL to the workflow exposing that webhook path', () => {
    const { edges } = extractWebhookHttpLinks([producer, consumer])
    expect(edges).toEqual([{ source: 'c', target: 'p', type: 'webhookHttp' }])
  })

  it('flags expression URLs as unresolved instead of dropping them', () => {
    const exprConsumer: RawWorkflow = { id: 'c', name: 'C', nodes: [
      { name: 'http', type: 'n8n-nodes-base.httpRequest', parameters: { url: '={{ $json.endpoint }}' } },
    ] }
    const { edges, unresolved } = extractWebhookHttpLinks([producer, exprConsumer])
    expect(edges).toEqual([])
    expect(unresolved).toEqual([{ workflowId: 'c', nodeName: 'http', reason: 'URL built from expression' }])
  })

  it('does not link a workflow to its own webhook', () => {
    const selfRef: RawWorkflow = { id: 's', name: 'S', nodes: [
      { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'x' } },
      { name: 'http', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://h/webhook/x' } },
    ] }
    expect(extractWebhookHttpLinks([selfRef]).edges).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- server/parser/links.test.ts`
Expected: FAIL — `extractWebhookHttpLinks` is not exported.

- [ ] **Step 3: Add the implementation**

Append to `server/parser/links.ts`:
```ts
export interface WebhookHttpResult { edges: WorkflowEdge[]; unresolved: UnresolvedLink[] }

function webhookPathOf(node: RawNode): string | null {
  if (node.type !== 'n8n-nodes-base.webhook') return null
  const p = node.parameters?.path
  return typeof p === 'string' && p ? p.replace(/^\/+|\/+$/g, '') : null
}

function pathFromUrl(url: string): string | null {
  const m = url.match(/\/webhook(?:-test)?\/([^?#\s]+)/)
  return m ? m[1].replace(/\/+$/, '') : null
}

export function extractWebhookHttpLinks(workflows: RawWorkflow[]): WebhookHttpResult {
  const pathToWf = new Map<string, string>()
  for (const wf of workflows)
    for (const node of wf.nodes ?? []) {
      const p = webhookPathOf(node)
      if (p) pathToWf.set(p, wf.id)
    }

  const edges: WorkflowEdge[] = []
  const unresolved: UnresolvedLink[] = []
  for (const wf of workflows)
    for (const node of wf.nodes ?? []) {
      if (node.type !== 'n8n-nodes-base.httpRequest') continue
      const url = node.parameters?.url
      if (typeof url !== 'string' || !url) continue
      if (url.startsWith('=') || url.includes('{{')) {
        unresolved.push({ workflowId: wf.id, nodeName: node.name, reason: 'URL built from expression' })
        continue
      }
      const p = pathFromUrl(url)
      if (!p) continue
      const target = pathToWf.get(p)
      if (target && target !== wf.id) edges.push({ source: wf.id, target, type: 'webhookHttp' })
    }
  return { edges, unresolved }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- server/parser/links.test.ts`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
git add server/parser/links.ts server/parser/links.test.ts
git commit -m "feat: detect webhook->http links and flag unresolved URLs"
```

---

## Task 6: Parser — summary, tags, webhook paths

**Files:**
- Create: `server/parser/summarize.ts`
- Test: `server/parser/summarize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/parser/summarize.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { summarize, extractTags, extractWebhookPaths } from './summarize'
import type { RawWorkflow } from '~/types/graph'

const wf: RawWorkflow = {
  id: 'a', name: 'A',
  tags: [{ id: '1', name: 'prod' }, 'critical'],
  nodes: [
    { name: 'h1', type: 'n8n-nodes-base.httpRequest', credentials: { httpHeaderAuth: { name: 'My API' } } },
    { name: 'h2', type: 'n8n-nodes-base.httpRequest' },
    { name: 's', type: 'n8n-nodes-base.set' },
    { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: '/orders' } },
  ],
}

describe('summarize', () => {
  it('builds a node-type histogram sorted by count', () => {
    const s = summarize(wf)
    expect(s.nodeCount).toBe(4)
    expect(s.nodeTypes[0]).toEqual({ type: 'n8n-nodes-base.httpRequest', count: 2 })
    expect(s.credentials).toEqual(['My API'])
  })
})

describe('extractTags', () => {
  it('normalizes object and string tags to names', () => {
    expect(extractTags(wf)).toEqual(['prod', 'critical'])
  })
})

describe('extractWebhookPaths', () => {
  it('returns webhook paths without leading slashes', () => {
    expect(extractWebhookPaths(wf)).toEqual(['orders'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- server/parser/summarize.test.ts`
Expected: FAIL — cannot find module `./summarize`.

- [ ] **Step 3: Write the implementation**

Create `server/parser/summarize.ts`:
```ts
import type { RawWorkflow, WorkflowSummary } from '~/types/graph'

export function extractTags(wf: RawWorkflow): string[] {
  return (wf.tags ?? [])
    .map(t => (typeof t === 'string' ? t : t?.name))
    .filter((n): n is string => Boolean(n))
}

export function extractWebhookPaths(wf: RawWorkflow): string[] {
  const out: string[] = []
  for (const node of wf.nodes ?? []) {
    if (node.type !== 'n8n-nodes-base.webhook') continue
    const p = node.parameters?.path
    if (typeof p === 'string' && p) out.push(p.replace(/^\/+|\/+$/g, ''))
  }
  return out
}

export function summarize(wf: RawWorkflow): Omit<WorkflowSummary, 'inbound' | 'outbound'> {
  const counts = new Map<string, number>()
  const creds = new Set<string>()
  for (const node of wf.nodes ?? []) {
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1)
    for (const c of Object.values(node.credentials ?? {}))
      if (c?.name) creds.add(c.name)
  }
  const nodeTypes = [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
  return { nodeCount: wf.nodes?.length ?? 0, nodeTypes, credentials: [...creds] }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- server/parser/summarize.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/parser/summarize.ts server/parser/summarize.test.ts
git commit -m "feat: summarize workflows, extract tags and webhook paths"
```

---

## Task 7: Parser — graph orchestrator

**Files:**
- Create: `server/parser/build-graph.ts`
- Test: `server/parser/build-graph.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/parser/build-graph.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildGraph } from './build-graph'
import type { RawWorkflow } from '~/types/graph'

const producer: RawWorkflow = { id: 'p', name: 'Producer', active: true, nodes: [
  { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'orders' } },
] }
const consumer: RawWorkflow = { id: 'c', name: 'Consumer', nodes: [
  { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: 'p' } },
  { name: 'http', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://h/webhook/orders' } },
] }

describe('buildGraph', () => {
  it('produces nodes with inbound/outbound counts and a deep link', () => {
    const g = buildGraph([producer, consumer], 'https://n8n.example.com/')
    const p = g.nodes.find(n => n.id === 'p')!
    const c = g.nodes.find(n => n.id === 'c')!
    expect(p.summary.inbound).toBe(2)   // execute + webhookHttp both target p
    expect(c.summary.outbound).toBe(2)
    expect(p.deepLink).toBe('https://n8n.example.com/workflow/p')
  })

  it('sets deepLink to null when no base URL is given', () => {
    const g = buildGraph([producer], null)
    expect(g.nodes[0].deepLink).toBeNull()
  })

  it('drops edges pointing at unknown workflows', () => {
    const lone: RawWorkflow = { id: 'x', name: 'X', nodes: [
      { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: 'missing' } },
    ] }
    expect(buildGraph([lone], null).edges).toEqual([])
  })

  it('skips malformed workflows but keeps the rest', () => {
    const bad = { name: 'no id' } as unknown as RawWorkflow
    const g = buildGraph([producer, bad], null)
    expect(g.nodes.map(n => n.id)).toEqual(['p'])
    expect(g.skipped).toEqual([{ name: 'no id', reason: 'missing id or nodes' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- server/parser/build-graph.test.ts`
Expected: FAIL — cannot find module `./build-graph`.

- [ ] **Step 3: Write the implementation**

Create `server/parser/build-graph.ts`:
```ts
import type {
  RawWorkflow, WorkflowGraph, WorkflowNode, WorkflowEdge,
  UnresolvedLink, SkippedWorkflow,
} from '~/types/graph'
import { classifyTriggers } from './triggers'
import { extractExecuteLinks, extractErrorLink, extractWebhookHttpLinks } from './links'
import { summarize, extractTags, extractWebhookPaths } from './summarize'

export function buildGraph(workflows: RawWorkflow[], baseUrl: string | null): WorkflowGraph {
  const valid: RawWorkflow[] = []
  const skipped: SkippedWorkflow[] = []
  for (const wf of workflows ?? []) {
    if (!wf || typeof wf.id !== 'string' || !Array.isArray(wf.nodes)) {
      skipped.push({ name: wf?.name, reason: 'missing id or nodes' })
      continue
    }
    valid.push(wf)
  }

  const edges: WorkflowEdge[] = []
  const unresolved: UnresolvedLink[] = []
  for (const wf of valid) {
    edges.push(...extractExecuteLinks(wf))
    const err = extractErrorLink(wf)
    if (err) edges.push(err)
  }
  const wh = extractWebhookHttpLinks(valid)
  edges.push(...wh.edges)
  unresolved.push(...wh.unresolved)

  const ids = new Set(valid.map(w => w.id))
  const keptEdges = edges.filter(e => ids.has(e.source) && ids.has(e.target))

  const inbound = new Map<string, number>()
  const outbound = new Map<string, number>()
  for (const e of keptEdges) {
    outbound.set(e.source, (outbound.get(e.source) ?? 0) + 1)
    inbound.set(e.target, (inbound.get(e.target) ?? 0) + 1)
  }

  const base = baseUrl ? baseUrl.replace(/\/+$/, '') : null
  const nodes: WorkflowNode[] = valid.map(wf => ({
    id: wf.id,
    name: wf.name,
    active: wf.active ?? false,
    triggers: classifyTriggers(wf),
    tags: extractTags(wf),
    webhookPaths: extractWebhookPaths(wf),
    summary: { ...summarize(wf), inbound: inbound.get(wf.id) ?? 0, outbound: outbound.get(wf.id) ?? 0 },
    deepLink: base ? `${base}/workflow/${wf.id}` : null,
  }))

  return { nodes, edges: keptEdges, unresolved, skipped }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- server/parser/build-graph.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/parser/build-graph.ts server/parser/build-graph.test.ts
git commit -m "feat: assemble WorkflowGraph from parsed workflows"
```

---

## Task 8: Ingest — input normalization

**Files:**
- Create: `server/ingest/normalize.ts`
- Test: `server/ingest/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/ingest/normalize.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizeWorkflows } from './normalize'

describe('normalizeWorkflows', () => {
  it('passes through an array unchanged', () => {
    const arr = [{ id: 'a', name: 'A', nodes: [] }]
    expect(normalizeWorkflows(arr)).toEqual(arr)
  })

  it('unwraps an n8n API/export { data: [...] } bundle', () => {
    const arr = [{ id: 'a', name: 'A', nodes: [] }]
    expect(normalizeWorkflows({ data: arr })).toEqual(arr)
  })

  it('wraps a single workflow object into an array', () => {
    const one = { id: 'a', name: 'A', nodes: [] }
    expect(normalizeWorkflows(one)).toEqual([one])
  })

  it('returns [] for unrecognized input', () => {
    expect(normalizeWorkflows(42)).toEqual([])
    expect(normalizeWorkflows(null)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- server/ingest/normalize.test.ts`
Expected: FAIL — cannot find module `./normalize`.

- [ ] **Step 3: Write the implementation**

Create `server/ingest/normalize.ts`:
```ts
import type { RawWorkflow } from '~/types/graph'

export function normalizeWorkflows(input: unknown): RawWorkflow[] {
  if (Array.isArray(input)) return input as RawWorkflow[]
  if (input && typeof input === 'object') {
    const obj = input as Record<string, any>
    if (Array.isArray(obj.data)) return obj.data as RawWorkflow[]
    if (Array.isArray(obj.workflows)) return obj.workflows as RawWorkflow[]
    if (typeof obj.id === 'string' || Array.isArray(obj.nodes)) return [obj as RawWorkflow]
  }
  return []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- server/ingest/normalize.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/ingest/normalize.ts server/ingest/normalize.test.ts
git commit -m "feat: normalize upload shapes to RawWorkflow[]"
```

---

## Task 9: Ingest — n8n API client

**Files:**
- Create: `server/ingest/n8n-client.ts`
- Test: `server/ingest/n8n-client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/ingest/n8n-client.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchAllWorkflows } from './n8n-client'

afterEach(() => vi.restoreAllMocks())

describe('fetchAllWorkflows', () => {
  it('follows nextCursor pagination and concatenates pages', async () => {
    const pages = [
      { data: [{ id: 'a', name: 'A', nodes: [] }], nextCursor: 'cur2' },
      { data: [{ id: 'b', name: 'B', nodes: [] }], nextCursor: null },
    ]
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => pages[0] })
      .mockResolvedValueOnce({ ok: true, json: async () => pages[1] })
    vi.stubGlobal('fetch', fetchMock)

    const got = await fetchAllWorkflows('https://n8n.example.com', 'key')
    expect(got.map(w => w.id)).toEqual(['a', 'b'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstUrl = fetchMock.mock.calls[0][0].toString()
    expect(firstUrl).toContain('/api/v1/workflows')
  })

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }))
    await expect(fetchAllWorkflows('https://h', 'bad')).rejects.toThrow('401')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- server/ingest/n8n-client.test.ts`
Expected: FAIL — cannot find module `./n8n-client`.

- [ ] **Step 3: Write the implementation**

Create `server/ingest/n8n-client.ts`:
```ts
import type { RawWorkflow } from '~/types/graph'

interface ListResponse { data: RawWorkflow[]; nextCursor?: string | null }

export async function fetchAllWorkflows(baseUrl: string, apiKey: string): Promise<RawWorkflow[]> {
  const base = baseUrl.replace(/\/+$/, '')
  const all: RawWorkflow[] = []
  let cursor: string | undefined

  do {
    const url = new URL(`${base}/api/v1/workflows`)
    url.searchParams.set('limit', '250')
    if (cursor) url.searchParams.set('cursor', cursor)

    const res = await fetch(url, { headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' } })
    if (!res.ok) throw new Error(`n8n API request failed: ${res.status}`)

    const body = (await res.json()) as ListResponse
    all.push(...(body.data ?? []))
    cursor = body.nextCursor ?? undefined
  } while (cursor)

  return all
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- server/ingest/n8n-client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/ingest/n8n-client.ts server/ingest/n8n-client.test.ts
git commit -m "feat: paginated n8n REST workflow fetch"
```

---

## Task 10: API routes

**Files:**
- Create: `server/api/ingest/api.post.ts`
- Create: `server/api/ingest/upload.post.ts`

- [ ] **Step 1: Write the API ingest route**

Create `server/api/ingest/api.post.ts`:
```ts
import { fetchAllWorkflows } from '../../ingest/n8n-client'
import { buildGraph } from '../../parser/build-graph'

export default defineEventHandler(async (event) => {
  const { baseUrl, apiKey } = await readBody(event)
  if (!baseUrl || !apiKey)
    throw createError({ statusCode: 400, statusMessage: 'baseUrl and apiKey are required' })

  try {
    const workflows = await fetchAllWorkflows(baseUrl, apiKey)
    return buildGraph(workflows, baseUrl)
  } catch (e: any) {
    throw createError({ statusCode: 502, statusMessage: e?.message ?? 'n8n fetch failed' })
  }
})
```

- [ ] **Step 2: Write the upload ingest route**

Create `server/api/ingest/upload.post.ts`:
```ts
import { normalizeWorkflows } from '../../ingest/normalize'
import { buildGraph } from '../../parser/build-graph'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const raw = body?.workflows ?? body
  const baseUrl = typeof body?.baseUrl === 'string' && body.baseUrl ? body.baseUrl : null
  const workflows = normalizeWorkflows(raw)
  return buildGraph(workflows, baseUrl)
})
```

- [ ] **Step 3: Smoke-test the upload route**

Run:
```bash
bun run dev &
sleep 8
curl -s -X POST http://localhost:3000/api/ingest/upload \
  -H 'content-type: application/json' \
  -d '{"workflows":[{"id":"a","name":"A","nodes":[{"name":"h","type":"n8n-nodes-base.webhook","parameters":{"path":"x"}}]}],"baseUrl":"https://n8n.example.com"}'
kill %1
```
Expected: JSON with `nodes[0].deepLink` = `https://n8n.example.com/workflow/a` and `nodes[0].triggers` = `["webhook"]`.

- [ ] **Step 4: Commit**

```bash
git add server/api/ingest/api.post.ts server/api/ingest/upload.post.ts
git commit -m "feat: ingest API routes for live API and JSON upload"
```

---

## Task 11: Pinia store

**Files:**
- Create: `stores/graph.ts`

- [ ] **Step 1: Write the store**

Create `stores/graph.ts`:
```ts
import { defineStore } from 'pinia'
import type { WorkflowGraph } from '~/types/graph'

export const useGraphStore = defineStore('graph', () => {
  const graph = ref<WorkflowGraph | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedId = ref<string | null>(null)
  const tagFilter = ref<string[]>([])
  const linkTypes = ref<Record<string, boolean>>({ execute: true, webhookHttp: true, error: true })

  function extractError(e: any): string {
    return e?.data?.statusMessage ?? e?.statusMessage ?? e?.message ?? 'Request failed'
  }

  async function loadFromApi(baseUrl: string, apiKey: string) {
    loading.value = true; error.value = null
    try {
      graph.value = await $fetch<WorkflowGraph>('/api/ingest/api', { method: 'POST', body: { baseUrl, apiKey } })
    } catch (e) { error.value = extractError(e) } finally { loading.value = false }
  }

  async function loadFromUpload(workflows: unknown, baseUrl: string | null) {
    loading.value = true; error.value = null
    try {
      graph.value = await $fetch<WorkflowGraph>('/api/ingest/upload', { method: 'POST', body: { workflows, baseUrl } })
    } catch (e) { error.value = extractError(e) } finally { loading.value = false }
  }

  const selected = computed(() => graph.value?.nodes.find(n => n.id === selectedId.value) ?? null)

  return { graph, loading, error, selectedId, selected, tagFilter, linkTypes, loadFromApi, loadFromUpload }
})
```

- [ ] **Step 2: Typecheck**

Run: `bun x vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add stores/graph.ts
git commit -m "feat: Pinia graph store with API/upload loaders and view state"
```

---

## Task 12: Force layout composable

**Files:**
- Create: `composables/useForceLayout.ts`
- Test: `composables/useForceLayout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `composables/useForceLayout.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeLayout } from './useForceLayout'
import type { WorkflowGraph } from '~/types/graph'

const graph: WorkflowGraph = {
  nodes: [
    { id: 'a', name: 'A', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 1 } },
    { id: 'b', name: 'B', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 1, outbound: 0 } },
  ],
  edges: [{ source: 'a', target: 'b', type: 'execute' }],
  unresolved: [], skipped: [],
}

describe('computeLayout', () => {
  it('returns finite positions for every node', () => {
    const pos = computeLayout(graph)
    expect(pos.size).toBe(2)
    for (const id of ['a', 'b']) {
      const p = pos.get(id)!
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- composables/useForceLayout.test.ts`
Expected: FAIL — cannot find module `./useForceLayout`.

- [ ] **Step 3: Write the implementation**

Create `composables/useForceLayout.ts`:
```ts
import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from 'd3-force'
import type { WorkflowGraph } from '~/types/graph'

export interface Point { x: number; y: number }

export function computeLayout(graph: WorkflowGraph, width = 1200, height = 800): Map<string, Point> {
  const simNodes = graph.nodes.map(n => ({ id: n.id }))
  const simLinks = graph.edges.map(e => ({ source: e.source, target: e.target }))

  const sim = forceSimulation(simNodes as any)
    .force('charge', forceManyBody().strength(-320))
    .force('link', forceLink(simLinks as any).id((d: any) => d.id).distance(140))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide(64))
    .stop()

  for (let i = 0; i < 300; i++) sim.tick()

  const out = new Map<string, Point>()
  for (const n of sim.nodes() as any[]) out.set(n.id, { x: n.x, y: n.y })
  return out
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- composables/useForceLayout.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add composables/useForceLayout.ts composables/useForceLayout.test.ts
git commit -m "feat: precomputed d3-force layout for the map"
```

---

## Task 13: Search and tag-filter composables

**Files:**
- Create: `composables/useSearch.ts`
- Create: `composables/useTagFilter.ts`
- Test: `composables/useSearch.test.ts`
- Test: `composables/useTagFilter.test.ts`

- [ ] **Step 1: Write the failing search test**

Create `composables/useSearch.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { searchGraph } from './useSearch'
import type { WorkflowGraph } from '~/types/graph'

const graph: WorkflowGraph = {
  nodes: [
    { id: 'p', name: 'Order Producer', active: true, triggers: ['webhook'], tags: [],
      webhookPaths: ['orders'], deepLink: null,
      summary: { nodeCount: 1, nodeTypes: [{ type: 'n8n-nodes-base.httpRequest', count: 1 }], credentials: [], inbound: 0, outbound: 0 } },
  ],
  edges: [], unresolved: [], skipped: [],
}

describe('searchGraph', () => {
  it('resolves a webhook path to its workflow', () => {
    const hits = searchGraph(graph, 'orders')
    expect(hits).toContainEqual({ workflowId: 'p', label: 'webhook: orders', kind: 'webhook' })
  })

  it('matches workflow names case-insensitively', () => {
    expect(searchGraph(graph, 'producer')[0].workflowId).toBe('p')
  })

  it('returns nothing for a blank query', () => {
    expect(searchGraph(graph, '   ')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- composables/useSearch.test.ts`
Expected: FAIL — cannot find module `./useSearch`.

- [ ] **Step 3: Write the search implementation**

Create `composables/useSearch.ts`:
```ts
import type { WorkflowGraph } from '~/types/graph'

export interface SearchHit { workflowId: string; label: string; kind: 'name' | 'webhook' | 'node' }

export function searchGraph(graph: WorkflowGraph | null, query: string): SearchHit[] {
  const term = query.trim().toLowerCase()
  if (!term || !graph) return []
  const hits: SearchHit[] = []
  for (const n of graph.nodes) {
    if (n.name.toLowerCase().includes(term))
      hits.push({ workflowId: n.id, label: n.name, kind: 'name' })
    for (const p of n.webhookPaths)
      if (p.toLowerCase().includes(term))
        hits.push({ workflowId: n.id, label: `webhook: ${p}`, kind: 'webhook' })
    for (const nt of n.summary.nodeTypes)
      if (nt.type.toLowerCase().includes(term))
        hits.push({ workflowId: n.id, label: `${nt.type} (×${nt.count})`, kind: 'node' })
  }
  return hits
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- composables/useSearch.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing tag-filter test**

Create `composables/useTagFilter.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { allTags, matchesTags } from './useTagFilter'
import type { WorkflowNode, WorkflowGraph } from '~/types/graph'

const node = (tags: string[]): WorkflowNode => ({
  id: 'x', name: 'X', active: true, triggers: [], tags, webhookPaths: [], deepLink: null,
  summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 },
})

describe('allTags', () => {
  it('returns sorted unique tags across the graph', () => {
    const graph = { nodes: [node(['b', 'a']), node(['a', 'c'])], edges: [], unresolved: [], skipped: [] } as WorkflowGraph
    expect(allTags(graph)).toEqual(['a', 'b', 'c'])
  })
})

describe('matchesTags', () => {
  it('matches all nodes when no tag is selected', () => {
    expect(matchesTags(node([]), [])).toBe(true)
  })
  it('matches when the node shares any selected tag', () => {
    expect(matchesTags(node(['a', 'b']), ['b'])).toBe(true)
    expect(matchesTags(node(['a']), ['z'])).toBe(false)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test -- composables/useTagFilter.test.ts`
Expected: FAIL — cannot find module `./useTagFilter`.

- [ ] **Step 7: Write the tag-filter implementation**

Create `composables/useTagFilter.ts`:
```ts
import type { WorkflowGraph, WorkflowNode } from '~/types/graph'

export function allTags(graph: WorkflowGraph | null): string[] {
  if (!graph) return []
  return [...new Set(graph.nodes.flatMap(n => n.tags))].sort()
}

export function matchesTags(node: WorkflowNode, selected: string[]): boolean {
  if (selected.length === 0) return true
  return node.tags.some(t => selected.includes(t))
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test -- composables/useTagFilter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add composables/useSearch.ts composables/useSearch.test.ts composables/useTagFilter.ts composables/useTagFilter.test.ts
git commit -m "feat: search and tag-filter composables"
```

---

## Task 14: Custom workflow node component

**Files:**
- Create: `components/WorkflowNodeCard.vue`
- Test: `components/WorkflowNodeCard.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `components/WorkflowNodeCard.spec.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WorkflowNodeCard from './WorkflowNodeCard.vue'

const baseData = {
  label: 'Order Flow', triggers: ['webhook'], inbound: 3, dimmed: false,
}

describe('WorkflowNodeCard', () => {
  it('renders the workflow name and a trigger icon', () => {
    const w = mount(WorkflowNodeCard, { props: { data: baseData } })
    expect(w.text()).toContain('Order Flow')
    expect(w.find('[data-trigger="webhook"]').exists()).toBe(true)
  })

  it('applies a dimmed class when data.dimmed is true', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { ...baseData, dimmed: true } } })
    expect(w.classes()).toContain('dimmed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- components/WorkflowNodeCard.spec.ts`
Expected: FAIL — cannot find module `./WorkflowNodeCard.vue`.

- [ ] **Step 3: Write the component**

Create `components/WorkflowNodeCard.vue`:
```vue
<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'
import type { TriggerType } from '~/types/graph'

const props = defineProps<{
  data: { label: string; triggers: TriggerType[]; inbound: number; dimmed: boolean }
}>()

const icons: Record<TriggerType, string> = {
  webhook: '⚡', schedule: '⏰', manual: '▶', app: '🧩', unknown: '•',
}
const size = computed(() => 36 + Math.min(props.data.inbound, 12) * 6)
</script>

<template>
  <div class="node" :class="{ dimmed: data.dimmed }"
       :style="{ minWidth: size + 'px' }">
    <Handle type="target" :position="Position.Left" />
    <span v-for="t in data.triggers" :key="t" class="ico" :data-trigger="t">{{ icons[t] }}</span>
    <span class="label">{{ data.label }}</span>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.node { display: flex; align-items: center; gap: 6px; padding: 8px 12px;
  border: 1px solid #888; border-radius: 8px; background: #fff; font-size: 13px; }
.node.dimmed { opacity: 0.25; }
.label { font-weight: 600; }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- components/WorkflowNodeCard.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/WorkflowNodeCard.vue components/WorkflowNodeCard.spec.ts
git commit -m "feat: custom Vue Flow workflow node card"
```

---

## Task 15: Side panel component

**Files:**
- Create: `components/SidePanel.vue`
- Test: `components/SidePanel.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `components/SidePanel.spec.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SidePanel from './SidePanel.vue'
import type { WorkflowNode } from '~/types/graph'

const node: WorkflowNode = {
  id: 'a', name: 'Order Flow', active: true, triggers: ['webhook'], tags: ['prod'],
  webhookPaths: ['orders'], deepLink: 'https://n8n.example.com/workflow/a',
  summary: { nodeCount: 3, nodeTypes: [{ type: 'n8n-nodes-base.httpRequest', count: 2 }], credentials: ['My API'], inbound: 1, outbound: 0 },
}

describe('SidePanel', () => {
  it('renders summary and an Open in n8n link to the deep link', () => {
    const w = mount(SidePanel, { props: { node } })
    expect(w.text()).toContain('Order Flow')
    expect(w.text()).toContain('n8n-nodes-base.httpRequest')
    const link = w.find('a.deep-link')
    expect(link.attributes('href')).toBe('https://n8n.example.com/workflow/a')
  })

  it('hides the deep link when node.deepLink is null', () => {
    const w = mount(SidePanel, { props: { node: { ...node, deepLink: null } } })
    expect(w.find('a.deep-link').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- components/SidePanel.spec.ts`
Expected: FAIL — cannot find module `./SidePanel.vue`.

- [ ] **Step 3: Write the component**

Create `components/SidePanel.vue`:
```vue
<script setup lang="ts">
import type { WorkflowNode } from '~/types/graph'

defineProps<{ node: WorkflowNode }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <aside class="panel">
    <header>
      <h2>{{ node.name }}</h2>
      <button @click="$emit('close')">×</button>
    </header>

    <p class="meta">
      <span :class="['badge', node.active ? 'on' : 'off']">{{ node.active ? 'active' : 'inactive' }}</span>
      <span v-for="t in node.triggers" :key="t" class="badge">{{ t }}</span>
    </p>

    <a v-if="node.deepLink" class="deep-link" :href="node.deepLink" target="_blank" rel="noopener noreferrer">
      Open in n8n ↗
    </a>

    <section v-if="node.tags.length">
      <h3>Tags</h3>
      <span v-for="tag in node.tags" :key="tag" class="badge">{{ tag }}</span>
    </section>

    <section v-if="node.webhookPaths.length">
      <h3>Webhooks</h3>
      <ul><li v-for="p in node.webhookPaths" :key="p"><code>/{{ p }}</code></li></ul>
    </section>

    <section>
      <h3>Nodes ({{ node.summary.nodeCount }})</h3>
      <ul><li v-for="nt in node.summary.nodeTypes" :key="nt.type">{{ nt.count }}× {{ nt.type }}</li></ul>
    </section>

    <section v-if="node.summary.credentials.length">
      <h3>Credentials</h3>
      <ul><li v-for="c in node.summary.credentials" :key="c">{{ c }}</li></ul>
    </section>

    <section>
      <h3>Links</h3>
      <p>Inbound: {{ node.summary.inbound }} · Outbound: {{ node.summary.outbound }}</p>
    </section>
  </aside>
</template>

<style scoped>
.panel { position: absolute; top: 0; right: 0; width: 320px; height: 100%; overflow-y: auto;
  background: #fff; border-left: 1px solid #ddd; padding: 16px; box-shadow: -2px 0 8px rgba(0,0,0,.06); }
header { display: flex; justify-content: space-between; align-items: center; }
.badge { display: inline-block; padding: 2px 8px; margin: 2px; border-radius: 10px; background: #eee; font-size: 12px; }
.badge.on { background: #d6f5d6; } .badge.off { background: #f5d6d6; }
.deep-link { display: inline-block; margin: 8px 0; font-weight: 600; }
section h3 { margin: 14px 0 4px; font-size: 13px; text-transform: uppercase; color: #666; }
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- components/SidePanel.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add components/SidePanel.vue components/SidePanel.spec.ts
git commit -m "feat: workflow side panel with deep link"
```

---

## Task 16: Map canvas component

**Files:**
- Create: `components/WorkflowMap.vue`

This component is wired in `pages/index.vue` (Task 18) and verified manually in Task 18. It has no unit test (it is thin glue over Vue Flow); its inputs — layout, search, tag filtering — are all tested as composables.

- [ ] **Step 1: Write the component**

Create `components/WorkflowMap.vue`:
```vue
<script setup lang="ts">
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import type { Edge, Node } from '@vue-flow/core'
import { computeLayout } from '~/composables/useForceLayout'
import { matchesTags } from '~/composables/useTagFilter'
import { useGraphStore } from '~/stores/graph'

const store = useGraphStore()

const edgeStyle: Record<string, Record<string, any>> = {
  execute: { stroke: '#3b82f6' },
  webhookHttp: { stroke: '#10b981', strokeDasharray: '6 4' },
  error: { stroke: '#ef4444' },
}

const nodes = computed<Node[]>(() => {
  const g = store.graph
  if (!g) return []
  const pos = computeLayout(g)
  return g.nodes.map(n => ({
    id: n.id,
    type: 'workflow',
    position: pos.get(n.id) ?? { x: 0, y: 0 },
    data: {
      label: n.name,
      triggers: n.triggers,
      inbound: n.summary.inbound,
      dimmed: !matchesTags(n, store.tagFilter),
    },
  }))
})

const edges = computed<Edge[]>(() => {
  const g = store.graph
  if (!g) return []
  return g.edges
    .filter(e => store.linkTypes[e.type])
    .map((e, i) => ({
      id: `e${i}`, source: e.source, target: e.target,
      animated: e.type === 'webhookHttp', style: edgeStyle[e.type],
    }))
})

function onNodeClick({ node }: { node: Node }) {
  store.selectedId = node.id
}
</script>

<template>
  <VueFlow :nodes="nodes" :edges="edges" fit-view-on-init @node-click="onNodeClick">
    <template #node-workflow="props">
      <WorkflowNodeCard :data="props.data" />
    </template>
    <Background />
    <Controls />
  </VueFlow>
</template>
```

- [ ] **Step 2: Typecheck**

Run: `bun x vue-tsc --noEmit`
Expected: no errors. (Verification of rendering happens in Task 18.)

- [ ] **Step 3: Commit**

```bash
git add components/WorkflowMap.vue
git commit -m "feat: Vue Flow map canvas with filters and node selection"
```

---

## Task 17: Toolbar component

**Files:**
- Create: `components/Toolbar.vue`

- [ ] **Step 1: Write the component**

Create `components/Toolbar.vue`:
```vue
<script setup lang="ts">
import { useGraphStore } from '~/stores/graph'
import { allTags } from '~/composables/useTagFilter'
import { searchGraph } from '~/composables/useSearch'

const store = useGraphStore()

const baseUrl = ref('')
const apiKey = ref('')
const uploadBaseUrl = ref('')
const query = ref('')
const showUnresolved = ref(false)

const tags = computed(() => allTags(store.graph))
const results = computed(() => searchGraph(store.graph, query.value).slice(0, 10))

function toggleTag(tag: string) {
  store.tagFilter = store.tagFilter.includes(tag)
    ? store.tagFilter.filter(t => t !== tag)
    : [...store.tagFilter, tag]
}

function pick(id: string) { store.selectedId = id; query.value = '' }

async function onUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const parsed = JSON.parse(await file.text())
  await store.loadFromUpload(parsed, uploadBaseUrl.value || null)
}
</script>

<template>
  <div class="toolbar">
    <details open>
      <summary>Connect</summary>
      <div class="row">
        <input v-model="baseUrl" placeholder="https://n8n.example.com" />
        <input v-model="apiKey" type="password" placeholder="API key" />
        <button :disabled="store.loading" @click="store.loadFromApi(baseUrl, apiKey)">Load via API</button>
      </div>
      <div class="row">
        <input v-model="uploadBaseUrl" placeholder="instance URL (optional, for links)" />
        <input type="file" accept="application/json" @change="onUpload" />
      </div>
      <p v-if="store.error" class="err">{{ store.error }}</p>
    </details>

    <div v-if="store.graph" class="row search">
      <input v-model="query" placeholder="Search workflows / webhooks…" />
      <ul v-if="results.length" class="results">
        <li v-for="r in results" :key="r.workflowId + r.label" @click="pick(r.workflowId)">
          <span class="kind">{{ r.kind }}</span> {{ r.label }}
        </li>
      </ul>
    </div>

    <div v-if="store.graph" class="row">
      <label v-for="(on, type) in store.linkTypes" :key="type">
        <input type="checkbox" v-model="store.linkTypes[type]" /> {{ type }}
      </label>
    </div>

    <div v-if="tags.length" class="row tags">
      <button v-for="tag in tags" :key="tag"
              :class="{ active: store.tagFilter.includes(tag) }" @click="toggleTag(tag)">
        {{ tag }}
      </button>
    </div>

    <div v-if="store.graph?.unresolved.length" class="row">
      <button @click="showUnresolved = !showUnresolved">
        Unresolved links ({{ store.graph.unresolved.length }})
      </button>
      <ul v-if="showUnresolved">
        <li v-for="(u, i) in store.graph.unresolved" :key="i">{{ u.workflowId }} · {{ u.nodeName }} — {{ u.reason }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.toolbar { padding: 10px; border-bottom: 1px solid #ddd; display: flex; flex-direction: column; gap: 8px; background: #fafafa; }
.row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; position: relative; }
.tags button.active { background: #3b82f6; color: #fff; }
.search .results { position: absolute; top: 100%; left: 0; background: #fff; border: 1px solid #ddd; list-style: none; margin: 0; padding: 4px; width: 320px; z-index: 5; }
.search .results li { padding: 4px 6px; cursor: pointer; }
.search .results li:hover { background: #eef; }
.kind { font-size: 11px; color: #888; margin-right: 6px; }
.err { color: #c00; }
</style>
```

- [ ] **Step 2: Typecheck**

Run: `bun x vue-tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/Toolbar.vue
git commit -m "feat: toolbar with connect, search, link filters, tags, unresolved"
```

---

## Task 18: Page wiring and end-to-end verification

**Files:**
- Create: `pages/index.vue`
- Modify: `app.vue`

- [ ] **Step 1: Reduce app.vue to a page host**

Replace `app.vue` with:
```vue
<template>
  <NuxtPage />
</template>
```

- [ ] **Step 2: Write the page**

Create `pages/index.vue`:
```vue
<script setup lang="ts">
import { useGraphStore } from '~/stores/graph'
const store = useGraphStore()
</script>

<template>
  <div class="app">
    <Toolbar />
    <div class="canvas">
      <ClientOnly>
        <WorkflowMap v-if="store.graph" />
      </ClientOnly>
      <p v-if="!store.graph && !store.loading" class="empty">Connect an n8n instance or upload workflow JSON to begin.</p>
      <p v-if="store.loading" class="empty">Loading…</p>
      <SidePanel v-if="store.selected" :node="store.selected" @close="store.selectedId = null" />
    </div>
  </div>
</template>

<style scoped>
.app { display: flex; flex-direction: column; height: 100vh; }
.canvas { position: relative; flex: 1; }
.empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: #888; }
</style>
```

- [ ] **Step 3: Run the full test suite**

Run: `bun run test`
Expected: all parser/ingest/composable/component tests PASS.

- [ ] **Step 4: Manual end-to-end check**

Run: `bun run dev`, open `http://localhost:3000`, and:
1. Create a local file `sample.json` containing an array of two workflows where workflow B has an `executeWorkflow` node targeting A's id and an `httpRequest` node hitting A's webhook path.
2. In the toolbar, set the optional instance URL to `https://n8n.example.com`, upload `sample.json`.
Expected: two nodes appear, an edge connects B→A, clicking A opens the side panel with an "Open in n8n" link to `https://n8n.example.com/workflow/<A-id>`, search for the webhook path selects A, and a tag button dims non-matching nodes.

- [ ] **Step 5: Commit**

```bash
git add app.vue pages/index.vue
git commit -m "feat: wire toolbar, map, and side panel into the index page"
```

---

## Self-Review Notes

- **Spec coverage:** API + upload ingest (T9/T10), all four relationship/classification types (T3–T5, T7), side-panel summary with node histogram/credentials/links (T6/T15), deep links incl. null-on-no-baseUrl (T7/T15), force-directed hub sizing by inbound (T12/T14), search incl. webhook→workflow (T13/T17), tag filtering with dim-not-relayout (T13/T16/T17), unresolved-link surfacing (T5/T17), malformed-skip reporting (T7), error handling (T10/T11). All covered.
- **Types:** `WorkflowGraph`/`WorkflowNode`/`WorkflowEdge`/`LinkType` defined once in T2 and used verbatim downstream. `summarize` returns `Omit<WorkflowSummary,'inbound'|'outbound'>`; T7 fills the two counts — consistent.
- **Note for executor:** Vue Flow slot/prop names (`#node-<type>`, `fit-view-on-init`, `@node-click`) are from Vue Flow v1; if the installed version differs, confirm against `@vue-flow/core` docs and adjust — the data shapes feeding them are unaffected.
