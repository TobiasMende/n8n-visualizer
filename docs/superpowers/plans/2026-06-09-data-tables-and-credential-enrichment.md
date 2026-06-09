# Data Tables + Credential/Data-Table API Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add n8n Data Tables as a first-class entity (list view, graph overlay, side panel) mirroring Credentials, and enrich both Credentials and Data Tables with the n8n public API list endpoints when the key has scope — surfacing unused items and extra metadata, with silent fallback to workflow-inferred data.

**Architecture:** Server parses inferred data-table refs from workflow JSON (mirrors `credentials.ts`). The ingest route additionally makes best-effort `GET /credentials` and `GET /data-tables` calls; results are merged with inferred data (carrying a `source` flag) inside `buildGraph`. The Pinia store exposes `dataTables` plus selection state; Vue views/overlays mirror the existing credential components.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, Pinia, Vue Flow, Vitest. Test runner: `npm test` (`vitest run`). Lint: `npm run lint`.

**Spec:** `docs/superpowers/specs/2026-06-09-data-tables-and-credential-enrichment-design.md`

---

## File Structure

**Server (new):**
- `server/parser/data-tables.ts` — `extractDataTables` inferred parser
- `server/parser/data-tables.test.ts`
- `server/parser/merge.ts` — `mergeCredentials`, `mergeDataTables`
- `server/parser/merge.test.ts`

**Server (modified):**
- `shared/types/graph.ts` — `EntitySource`, extend `CredentialRef`, add `DataTableColumn`/`DataTableRef`, add `dataTables` + `enrichment` to `WorkflowGraph`
- `server/parser/credentials.ts` — stamp `source: 'inferred'`
- `server/parser/build-graph.ts` — call `extractDataTables`, accept API lists, run merges, populate `enrichment`
- `server/parser/build-graph.test.ts` — defaults for new fields
- `server/ingest/n8n-client.ts` — best-effort `fetchAllCredentials` / `fetchAllDataTables`
- `server/ingest/n8n-client.test.ts` — tests for the new fetchers
- `server/api/ingest/api.post.ts` — call best-effort fetchers, pass to `buildGraph`

**Client (new):**
- `app/composables/useDataTableView.ts` + `.test.ts`
- `app/components/DataTablesView.vue`
- `app/components/DataTablePanel.vue`

**Client (modified):**
- `app/composables/useVisibility.ts` — `overlays.dataTables`
- `app/composables/useMapLayers.ts` (+ `.test.ts` if present, else new test) — `dataTable` overlay nodes
- `app/composables/edgeColors.ts` — `dataTable` color (used by overlay edge stroke)
- `app/components/WorkflowNodeCard.vue` — `dataTable` kind styling
- `app/components/WorkflowMap.vue` — overlay color, miniColor, click → `selectedDataTableId`
- `app/stores/graph.ts` — `selectedDataTableId`, `selectedDataTable`, `ViewId` adds `dataTables`
- `app/components/AppShell.vue` — nav tab
- `app/pages/index.vue` — view + panel wiring
- `app/components/CredentialsView.vue` + `DataTablesView.vue` — orphan badge + hints
- `app/components/LayersPanel.vue` — data-tables overlay toggle

---

## Phase A — Data Tables: inferred parser + graph plumbing

### Task 1: Types

**Files:**
- Modify: `shared/types/graph.ts`

- [ ] **Step 1: Add the types**

Replace the existing `CredentialRef` interface (lines 44-49) and add the new types. The new `CredentialRef`:

```ts
export type EntitySource = 'api' | 'inferred' | 'both'

export interface CredentialRef {
  id: string | null
  name: string
  type: string
  workflowIds: string[]
  source: EntitySource
  createdAt?: string
  updatedAt?: string
}

export interface DataTableColumn { name: string; type: string }

export interface DataTableRef {
  id: string
  name: string
  projectId: string | null
  workflowIds: string[]
  operations: string[]
  source: EntitySource
  columns?: DataTableColumn[]
  createdAt?: string
  updatedAt?: string
}

export interface EnrichmentStatus { credentials: boolean; dataTables: boolean }
```

In `WorkflowGraph` (lines 82-91), add two fields after `credentials`:

```ts
  credentials: CredentialRef[]
  dataTables: DataTableRef[]
  enrichment: EnrichmentStatus
```

- [ ] **Step 2: Typecheck**

Run: `npx nuxt typecheck` (or `npx vue-tsc --noEmit` if configured)
Expected: errors only in files that consume these types (credentials.ts, build-graph.ts) — those are fixed in later tasks. No syntax errors in `graph.ts`.

- [ ] **Step 3: Commit**

```bash
git add shared/types/graph.ts
git commit -m "feat(types): add DataTableRef, EntitySource, enrichment to graph types"
```

---

### Task 2: `extractDataTables` inferred parser

**Files:**
- Create: `server/parser/data-tables.ts`
- Test: `server/parser/data-tables.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/parser/data-tables.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractDataTables } from './data-tables'
import type { RawWorkflow } from '#shared/types/graph'

const dtNode = (name: string, op: string | undefined, rl: Record<string, unknown>) => ({
  name, type: 'n8n-nodes-base.dataTable',
  parameters: { ...(op ? { operation: op } : {}), dataTableId: rl },
})
const listRl = {
  __rl: true, mode: 'list', value: 'tbl1', cachedResultName: 'Demo',
  cachedResultUrl: '/projects/projA/datatables/tbl1',
}

const a: RawWorkflow = { id: 'a', name: 'A', nodes: [dtNode('Insert row', undefined, listRl)] }
const b: RawWorkflow = { id: 'b', name: 'B', nodes: [dtNode('If row exists', 'rowExists', listRl)] }

describe('extractDataTables', () => {
  it('extracts id, name, projectId and defaults operation to insert', () => {
    const got = extractDataTables([a])
    expect(got).toEqual([{
      id: 'tbl1', name: 'Demo', projectId: 'projA',
      workflowIds: ['a'], operations: ['insert'], source: 'inferred',
    }])
  })

  it('dedupes a shared table across workflows and aggregates operations', () => {
    const got = extractDataTables([a, b])
    expect(got).toHaveLength(1)
    expect(got[0]).toMatchObject({
      id: 'tbl1', workflowIds: ['a', 'b'], operations: ['insert', 'rowExists'],
    })
  })

  it('falls back name to id when cachedResultName is missing', () => {
    const wf: RawWorkflow = { id: 'c', name: 'C', nodes: [
      dtNode('x', 'get', { __rl: true, mode: 'id', value: 'tbl9' }),
    ] }
    expect(extractDataTables([wf])[0]).toMatchObject({ id: 'tbl9', name: 'tbl9', projectId: null })
  })

  it('skips dynamic expression refs and missing values', () => {
    const wf: RawWorkflow = { id: 'd', name: 'D', nodes: [
      dtNode('expr', 'get', { __rl: true, mode: 'expression', value: '={{ $json.id }}' }),
      dtNode('empty', 'get', { __rl: true, mode: 'list', value: '' }),
      { name: 'plain', type: 'n8n-nodes-base.set', parameters: {} },
    ] }
    expect(extractDataTables([wf])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- data-tables`
Expected: FAIL — `extractDataTables is not a function` / module not found.

- [ ] **Step 3: Implement the parser**

Create `server/parser/data-tables.ts`:

```ts
import type { RawWorkflow, DataTableRef } from '#shared/types/graph'

const PROJECT_RE = /\/projects\/([^/]+)\/datatables\//

function parseRef(param: any): { id: string; name: string; projectId: string | null } | null {
  if (!param || typeof param !== 'object') return null
  if (param.mode === 'expression') return null
  const value = param.value
  if (typeof value !== 'string' || value === '' || value.startsWith('=')) return null
  const name = typeof param.cachedResultName === 'string' && param.cachedResultName ? param.cachedResultName : value
  const url = typeof param.cachedResultUrl === 'string' ? param.cachedResultUrl : ''
  const projectId = PROJECT_RE.exec(url)?.[1] ?? null
  return { id: value, name, projectId }
}

export function extractDataTables(workflows: RawWorkflow[]): DataTableRef[] {
  const byId = new Map<string, DataTableRef>()
  for (const wf of workflows ?? []) {
    for (const node of wf.nodes ?? []) {
      if (node.type !== 'n8n-nodes-base.dataTable') continue
      const ref = parseRef(node.parameters?.dataTableId)
      if (!ref) continue
      const op = typeof node.parameters?.operation === 'string' ? node.parameters.operation : 'insert'
      const existing = byId.get(ref.id)
      if (existing) {
        if (!existing.workflowIds.includes(wf.id)) existing.workflowIds.push(wf.id)
        if (!existing.operations.includes(op)) existing.operations.push(op)
      } else {
        byId.set(ref.id, {
          id: ref.id, name: ref.name, projectId: ref.projectId,
          workflowIds: [wf.id], operations: [op], source: 'inferred',
        })
      }
    }
  }
  return [...byId.values()]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- data-tables`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add server/parser/data-tables.ts server/parser/data-tables.test.ts
git commit -m "feat(parser): extract inferred data-table refs from workflows"
```

---

### Task 3: Stamp credential source + wire into build-graph

**Files:**
- Modify: `server/parser/credentials.ts:14`
- Modify: `server/parser/build-graph.ts:14,93,95`
- Modify: `server/parser/build-graph.test.ts`

- [ ] **Step 1: Update the credentials test for the new `source` field**

In `server/parser/credentials.test.ts`, update the two `toEqual` expectations to include `source: 'inferred'`:

```ts
    expect(api).toEqual({ id: '1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['a', 'b'], source: 'inferred' })
```
```ts
    expect(got.find(c => c.name === 'Slack Bot')).toEqual({ id: null, name: 'Slack Bot', type: 'slackApi', workflowIds: ['b'], source: 'inferred' })
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- credentials`
Expected: FAIL — actual object missing `source`.

- [ ] **Step 3: Stamp `source` in `extractCredentials`**

In `server/parser/credentials.ts`, line 14, add `source: 'inferred'` to the created object:

```ts
          byKey.set(key, { id: cred.id ?? null, name: cred.name, type, workflowIds: [wf.id], source: 'inferred' })
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- credentials`
Expected: PASS.

- [ ] **Step 5: Wire data tables + enrichment into build-graph**

In `server/parser/build-graph.ts`:

Add import after line 14:
```ts
import { extractDataTables } from './data-tables'
```

After line 93 (`const credentials = extractCredentials(valid)`), add:
```ts
  const dataTables = extractDataTables(valid)
```

Replace the return (line 95):
```ts
  return {
    nodes, edges: keptEdges, triggerNodes, unresolved, skipped, webhooks, schedules,
    credentials, dataTables, enrichment: { credentials: false, dataTables: false },
  }
```

- [ ] **Step 6: Update build-graph test for new fields**

In `server/parser/build-graph.test.ts`, find the assertion(s) on the returned graph shape and add expectations that `dataTables` is an array and `enrichment` equals `{ credentials: false, dataTables: false }`. Add this test inside the existing top-level `describe`:

```ts
  it('returns empty dataTables and unset enrichment by default', () => {
    const g = buildGraph([{ id: 'a', name: 'A', nodes: [] }], null)
    expect(g.dataTables).toEqual([])
    expect(g.enrichment).toEqual({ credentials: false, dataTables: false })
  })
```

- [ ] **Step 7: Run full parser tests**

Run: `npm test -- parser`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/parser/credentials.ts server/parser/credentials.test.ts server/parser/build-graph.ts server/parser/build-graph.test.ts
git commit -m "feat(parser): include inferred dataTables and enrichment status in graph"
```

---

## Phase B — Data Tables: graph overlay + views

### Task 4: Visibility overlay flag

**Files:**
- Modify: `app/composables/useVisibility.ts:7,17`

- [ ] **Step 1: Add the flag to the interface and default**

Line 7, extend the overlays type:
```ts
  overlays: { credentials: boolean; nodeTypes: boolean; dataTables: boolean }
```

Line 17, extend the default:
```ts
    overlays: { credentials: false, nodeTypes: false, dataTables: false },
```

- [ ] **Step 2: Typecheck the store merge still compiles**

The store's prefs-merge spreads `...(p.visibility.overlays ?? {})` over defaults, so it is forward-compatible. No change needed there.

Run: `npm test -- useVisibility` (if a test exists) else `npm run lint`
Expected: PASS / no new lint errors.

- [ ] **Step 3: Commit**

```bash
git add app/composables/useVisibility.ts
git commit -m "feat(map): add dataTables overlay visibility flag"
```

---

### Task 5: Data-table overlay nodes in `useMapLayers`

**Files:**
- Modify: `app/composables/useMapLayers.ts`
- Test: `app/composables/useMapLayers.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

Create `app/composables/useMapLayers.test.ts` (if it already exists, append the `describe`):

```ts
import { describe, it, expect } from 'vitest'
import { overlayNodesAndEdges } from './useMapLayers'
import type { WorkflowGraph } from '#shared/types/graph'

const graph = {
  nodes: [{ id: 'wf1', name: 'WF1', active: true, triggers: [], tags: [], webhookPaths: [],
    summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 }, deepLink: null }],
  edges: [], triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [],
  credentials: [],
  dataTables: [
    { id: 'tbl1', name: 'Demo', projectId: 'p', workflowIds: ['wf1'], operations: ['insert'], source: 'inferred' as const },
    { id: 'tbl2', name: 'Orphan', projectId: 'p', workflowIds: [], operations: [], source: 'api' as const },
  ],
  enrichment: { credentials: false, dataTables: false },
} as unknown as WorkflowGraph

const pos = new Map([['wf1', { x: 0, y: 0 }]])

describe('overlayNodesAndEdges dataTables layer', () => {
  it('emits a node + uses edge for used tables and skips orphans', () => {
    const { nodes, edges } = overlayNodesAndEdges(graph, pos,
      { credentials: false, nodeTypes: false, dataTables: true })
    expect(nodes.map(n => n.id)).toEqual(['datatable:tbl1'])
    expect(nodes[0]).toMatchObject({ kind: 'dataTable', label: 'Demo' })
    expect(edges).toEqual([{ id: 'e:wf1:datatable:tbl1', source: 'wf1', target: 'datatable:tbl1', kind: 'uses' }])
  })

  it('emits nothing when the layer is off', () => {
    const { nodes } = overlayNodesAndEdges(graph, pos,
      { credentials: false, nodeTypes: false, dataTables: false })
    expect(nodes).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- useMapLayers`
Expected: FAIL — `dataTable` nodes not produced; `layers` type missing `dataTables`.

- [ ] **Step 3: Implement the layer**

In `app/composables/useMapLayers.ts`:

Line 3, extend `OverlayNode.kind`:
```ts
export interface OverlayNode { id: string; kind: 'credential' | 'nodeType' | 'dataTable'; label: string; x: number; y: number }
```

Line 11, extend the `layers` param type:
```ts
  layers: { credentials: boolean; nodeTypes: boolean; dataTables: boolean },
```

After the `if (layers.credentials) { … }` block (before the `if (layers.nodeTypes)` block), add:
```ts
  if (layers.dataTables) {
    const baseIds = new Set(graph.nodes.map(n => n.id))
    for (const t of graph.dataTables) {
      if (t.workflowIds.length === 0) continue
      const id = `datatable:${t.id}`
      if (!seen.has(id)) {
        const pos = place(t.workflowIds[0] ?? '', nodes.length)
        nodes.push({ id, kind: 'dataTable', label: t.name, x: pos.x, y: pos.y })
        seen.add(id)
      }
      for (const wfId of t.workflowIds) {
        if (!baseIds.has(wfId)) continue
        edges.push({ id: `e:${wfId}:${id}`, source: wfId, target: id, kind: 'uses' })
      }
    }
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- useMapLayers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useMapLayers.ts app/composables/useMapLayers.test.ts
git commit -m "feat(map): render data tables as overlay nodes"
```

---

### Task 6: Node card + map wiring for `dataTable` kind

**Files:**
- Modify: `app/components/WorkflowNodeCard.vue:6,16-25,62-66`
- Modify: `app/components/WorkflowMap.vue:23-28,68-93,109-120`
- Modify: `app/composables/edgeColors.ts`

- [ ] **Step 1: Add a data-table color to edgeColors**

In `app/composables/edgeColors.ts`, add to `EDGE_COLORS`:
```ts
  dataTable: '#b48cff',
```

- [ ] **Step 2: Node card — support `dataTable` kind**

In `app/components/WorkflowNodeCard.vue`:

Line 6, extend `Kind`:
```ts
type Kind = 'workflow' | 'credential' | 'nodeType' | 'trigger' | 'dataTable'
```

Line 16, add an icon:
```ts
const kindIcon: Record<Kind, string> = { workflow: '🗂', credential: '🔑', nodeType: '◆', trigger: '⚡', dataTable: '🗄' }
```

Lines 17-21, add the accent color branch:
```ts
const accentColor = computed(() =>
  props.data.kind === 'credential' ? 'var(--warn)'
  : props.data.kind === 'nodeType' ? 'var(--link)'
  : props.data.kind === 'trigger' ? '#f5a623'
  : props.data.kind === 'dataTable' ? '#b48cff'
  : 'var(--accent)')
```

In `<style scoped>` after the `.kind-nodeType` rules (line 65), add:
```css
.kind-dataTable { border-color: #b48cff; }
.kind-dataTable .accent { display: none; }
.kind-dataTable .head { padding: 8px 12px; }
```

- [ ] **Step 3: Map — color, miniColor, click, selection**

In `app/components/WorkflowMap.vue`:

`miniColor` (lines 23-28) — add a branch before the final fallback:
```ts
function miniColor(node: Node) {
  return node.data?.kind === 'credential' ? '#ffb454'
    : node.data?.kind === 'nodeType' ? '#6aa0ff'
    : node.data?.kind === 'trigger' ? '#f5a623'
    : node.data?.kind === 'dataTable' ? '#b48cff'
    : '#3ddc97'
}
```

`overlayNodes` selection (line 90) — generalize `selected` to handle both credential and data-table selection:
```ts
  const overlayNodes: Node[] = overlay.value.nodes.map(o => ({
    id: o.id, type: 'workflow', position: { x: o.x, y: o.y },
    data: { kind: o.kind, label: o.label, triggers: [], inbound: 0, outbound: 0, nodeCount: 0, dimmed: focused.value,
      selected: o.id === store.selectedCredId || o.id === store.selectedDataTableId },
  }))
```

`overlayEdges` stroke (line 111) — color data-table edges violet:
```ts
  const overlayEdges: Edge[] = overlay.value.edges.map(o => ({
    id: o.id, source: o.source, target: o.target,
    style: { stroke: o.id.includes(':datatable:') ? '#b48cff' : o.kind === 'uses' ? '#ffb454' : '#6aa0ff',
      strokeDasharray: '4 4', opacity: focused.value ? 0.05 : 0.6 },
  }))
```

`onNodeClick` (lines 116-120) — add a data-table branch and reset the other selections:
```ts
function onNodeClick({ node }: { node: Node }) {
  if (node.data?.kind === 'workflow') { store.selectedId = node.id; store.selectedCredId = null; store.selectedDataTableId = null }
  else if (node.data?.kind === 'trigger') { store.selectedId = node.data.workflowId; store.selectedCredId = null; store.selectedDataTableId = null }
  else if (node.data?.kind === 'credential') { store.selectedCredId = node.id; store.selectedId = null; store.selectedDataTableId = null }
  else if (node.data?.kind === 'dataTable') { store.selectedDataTableId = node.id; store.selectedId = null; store.selectedCredId = null }
}
```

`onPaneClick` (line 122):
```ts
function onPaneClick() { store.selectedId = null; store.selectedCredId = null; store.selectedDataTableId = null }
```

> Note: `store.selectedDataTableId` is added in Task 7. Implement Task 7 before running the app; lint/typecheck for this task may report the missing store field until then — that is expected and resolved by Task 7.

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: no errors except possibly `selectedDataTableId` unknown on store (resolved in Task 7).

- [ ] **Step 5: Commit**

```bash
git add app/components/WorkflowNodeCard.vue app/components/WorkflowMap.vue app/composables/edgeColors.ts
git commit -m "feat(map): style and wire data-table overlay nodes"
```

---

### Task 7: Store selection + view id

**Files:**
- Modify: `app/stores/graph.ts:10,39,42,58-61,89`

- [ ] **Step 1: Add selection state**

After line 10 (`const selectedCredId = ref<string | null>(null)`), add:
```ts
  const selectedDataTableId = ref<string | null>(null)
```

In `disconnect()` (after line 39 `selectedCredId.value = null`), add:
```ts
    selectedDataTableId.value = null
```

After the `selectedCredential` computed (lines 58-59), add:
```ts
  const selectedDataTable = computed(() =>
    graph.value?.dataTables.find(d => `datatable:${d.id}` === selectedDataTableId.value) ?? null)
```

Line 61, extend `ViewId`:
```ts
  type ViewId = 'map' | 'webhooks' | 'schedules' | 'credentials' | 'dataTables'
```

Line 89, add the new exports to the return object:
```ts
  return { graph, loading, error, selectedId, selected, selectedCredId, selectedCredential, selectedDataTableId, selectedDataTable, tagFilter, searchQuery, loadFromApi, loadFromUpload, view, visibility, connection, connectedHost, disconnect, restoreConnection }
```

- [ ] **Step 2: Lint + run map tests**

Run: `npm run lint && npm test -- useMapLayers`
Expected: PASS, no lint errors.

- [ ] **Step 3: Commit**

```bash
git add app/stores/graph.ts
git commit -m "feat(store): add data-table selection state and view id"
```

---

### Task 8: `useDataTableView` composable

**Files:**
- Create: `app/composables/useDataTableView.ts`
- Test: `app/composables/useDataTableView.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/composables/useDataTableView.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { dataTableRows, dataTableWorkflows } from './useDataTableView'
import type { WorkflowGraph } from '#shared/types/graph'

const graph = {
  nodes: [
    { id: 'wf1', name: 'Alpha', active: true, triggers: [], tags: [], webhookPaths: [],
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 }, deepLink: null },
  ],
  edges: [], triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [], credentials: [],
  dataTables: [
    { id: 'tbl1', name: 'Demo', projectId: 'p', workflowIds: ['wf1'], operations: ['insert', 'rowExists'], source: 'both' as const,
      columns: [{ name: 'name', type: 'string' }] },
    { id: 'tbl2', name: 'Orphan', projectId: 'p', workflowIds: [], operations: [], source: 'api' as const },
  ],
  enrichment: { credentials: false, dataTables: true },
} as unknown as WorkflowGraph

describe('dataTableRows', () => {
  it('maps tables to rows with workflow counts, columns and unused flag', () => {
    const rows = dataTableRows(graph)
    expect(rows).toEqual([
      { id: 'tbl1', name: 'Demo', projectId: 'p', workflowCount: 1, workflowIds: ['wf1'],
        operations: ['insert', 'rowExists'], columnCount: 1, source: 'both', unused: false },
      { id: 'tbl2', name: 'Orphan', projectId: 'p', workflowCount: 0, workflowIds: [],
        operations: [], columnCount: 0, source: 'api', unused: true },
    ])
  })
  it('returns [] for null graph', () => {
    expect(dataTableRows(null)).toEqual([])
  })
})

describe('dataTableWorkflows', () => {
  it('resolves workflow ids to names sorted alphabetically', () => {
    expect(dataTableWorkflows(graph, 'tbl1')).toEqual([{ id: 'wf1', name: 'Alpha' }])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- useDataTableView`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the composable**

Create `app/composables/useDataTableView.ts`:

```ts
import type { WorkflowGraph } from '#shared/types/graph'
import { workflowNameMap } from './useGraphLookup'

export interface DataTableRow {
  id: string; name: string; projectId: string | null
  workflowCount: number; workflowIds: string[]
  operations: string[]; columnCount: number
  source: 'api' | 'inferred' | 'both'; unused: boolean
}

export function dataTableRows(graph: WorkflowGraph | null): DataTableRow[] {
  if (!graph) return []
  return graph.dataTables.map(t => ({
    id: t.id, name: t.name, projectId: t.projectId,
    workflowCount: t.workflowIds.length, workflowIds: t.workflowIds,
    operations: t.operations, columnCount: t.columns?.length ?? 0,
    source: t.source, unused: t.workflowIds.length === 0,
  }))
}

export function dataTableWorkflows(
  graph: WorkflowGraph | null, id: string,
): { id: string; name: string }[] {
  if (!graph) return []
  const table = graph.dataTables.find(t => t.id === id)
  if (!table) return []
  const nameById = workflowNameMap(graph)
  return table.workflowIds
    .map(wfId => ({ id: wfId, name: nameById.get(wfId) ?? wfId }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- useDataTableView`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useDataTableView.ts app/composables/useDataTableView.test.ts
git commit -m "feat(view): add data-table view composable"
```

---

### Task 9: `DataTablesView` list component

**Files:**
- Create: `app/components/DataTablesView.vue`

- [ ] **Step 1: Create the component**

Create `app/components/DataTablesView.vue` (mirrors `CredentialsView.vue`; includes unused badge + upload-mode hint):

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { dataTableRows, dataTableWorkflows } from '~/composables/useDataTableView'
import { matchesQuery, tagsMatch } from '~/composables/useViewFilter'
import { workflowTagsMap } from '~/composables/useGraphLookup'
import { onActivate } from '~/composables/useA11yClick'

const store = useGraphStore()
const expanded = ref<string | null>(null)

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'operations', label: 'Operations' },
  { key: 'columnCount', label: 'Columns' },
  { key: 'workflowCount', label: 'Workflows' },
]

const tagsByWf = computed(() => workflowTagsMap(store.graph))
function tableTags(r: { workflowIds: string[] }) {
  return [...new Set(r.workflowIds.flatMap(id => tagsByWf.value.get(id) ?? []))]
}
const rows = computed(() => dataTableRows(store.graph).filter(r =>
  tagsMatch(tableTags(r), store.tagFilter) &&
  matchesQuery(`${r.name} ${r.operations.join(' ')}`, store.searchQuery)))

const showUploadHint = computed(() => store.connection === null && rows.value.length > 0)

function toggle(id: string) { expanded.value = expanded.value === id ? null : id }
function jump(id: string) { store.selectedId = id; store.view = 'map' }
</script>

<template>
  <div class="wrap">
    <p v-if="showUploadHint" class="hint">Connect with an API token to see unused tables and column details.</p>
    <DataTable :columns="columns" :rows="rows" :row-key="(r) => r.id">
      <template #cell-name="{ row }">
        <strong>{{ row.name }}</strong>
        <Badge v-if="row.unused" class="unused">unused</Badge>
        <button class="exp" @click.stop="toggle(row.id)">workflows</button>
        <ul v-if="expanded === row.id" class="wflist">
          <li v-for="w in dataTableWorkflows(store.graph, row.id)" :key="w.id"
              role="button" tabindex="0"
              @click.stop="jump(w.id)"
              @keydown.stop="onActivate(() => jump(w.id))">↳ {{ w.name }}</li>
        </ul>
      </template>
      <template #cell-operations="{ row }">
        <Badge v-for="op in row.operations" :key="op">{{ op }}</Badge>
        <span v-if="!row.operations.length" class="muted">—</span>
      </template>
      <template #cell-columnCount="{ row }">{{ row.columnCount || '—' }}</template>
      <template #cell-workflowCount="{ row }">{{ row.workflowCount }}</template>
    </DataTable>
    <EmptyState v-if="!rows.length" title="No data tables" hint="No data tables referenced by any workflow." />
  </div>
</template>

<style scoped>
.wrap { position: relative; height: 100%; overflow: auto; padding: 12px; }
.hint { font-size: 12px; color: var(--text-dim); background: var(--bg-2); border: 1px solid var(--border);
  border-radius: var(--radius-s); padding: 6px 10px; margin: 0 0 10px; }
.unused { margin-left: 8px; background: var(--bg-3); color: var(--text-dim); }
.exp { margin-left: 8px; font-size: 11px; background: none; border: 1px solid var(--border);
  color: var(--text-dim); border-radius: var(--radius-s); cursor: pointer; padding: 1px 6px; }
.wflist { margin: 6px 0 0; padding-left: 14px; color: var(--accent); font-size: 12px; }
.wflist li { cursor: pointer; }
.muted { color: var(--text-faint); }
</style>
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/DataTablesView.vue
git commit -m "feat(view): add data tables list view"
```

---

### Task 10: `DataTablePanel` side panel

**Files:**
- Create: `app/components/DataTablePanel.vue`

- [ ] **Step 1: Create the component**

Create `app/components/DataTablePanel.vue` (mirrors `CredentialPanel.vue`):

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { DataTableRef } from '#shared/types/graph'
import { onActivate } from '~/composables/useA11yClick'
import { safeExternalHref } from '#shared/url'
import { useGraphStore } from '~/stores/graph'

const props = defineProps<{ dataTable: DataTableRef; workflows: { id: string; name: string }[] }>()
defineEmits<{ close: []; select: [id: string] }>()

const store = useGraphStore()
const deepLink = computed(() => {
  const base = store.connection?.baseUrl?.replace(/\/+$/, '')
  if (!base || !props.dataTable.projectId) return null
  return safeExternalHref(`${base}/projects/${props.dataTable.projectId}/datatables/${props.dataTable.id}`)
})
</script>

<template>
  <BasePanel @close="$emit('close')">
    <template #title><span class="ico" aria-hidden="true">🗄</span> {{ dataTable.name }}</template>
    <p class="meta">
      <span v-for="op in dataTable.operations" :key="op" class="badge">{{ op }}</span>
      <span v-if="dataTable.source === 'api'" class="badge unused">unused</span>
    </p>

    <a v-if="deepLink" class="deep-link" :href="deepLink" target="_blank" rel="noopener noreferrer">Open in n8n ↗</a>

    <section v-if="dataTable.columns?.length">
      <h3>Columns ({{ dataTable.columns.length }})</h3>
      <ul><li v-for="c in dataTable.columns" :key="c.name">{{ c.name }} <span class="muted">{{ c.type }}</span></li></ul>
    </section>

    <section>
      <h3>Used by ({{ workflows.length }})</h3>
      <ul>
        <li v-for="w in workflows" :key="w.id" class="link"
            role="button" tabindex="0"
            @click="$emit('select', w.id)"
            @keydown="onActivate(() => $emit('select', w.id))">↳ {{ w.name }}</li>
      </ul>
      <p v-if="!workflows.length" class="muted">No workflows.</p>
    </section>
  </BasePanel>
</template>

<style scoped>
.badge { display: inline-block; padding: 2px 8px; margin: 2px; border-radius: 10px; background: var(--bg-3); font-size: 12px; }
.badge.unused { background: var(--accent-dim); color: var(--text-dim); }
.deep-link { display: inline-block; margin: 8px 0; font-weight: 600; }
section h3 { margin: 14px 0 4px; font-size: 13px; text-transform: uppercase; color: var(--text-dim); }
.link { cursor: pointer; padding: 3px 4px; border-radius: var(--radius-s); color: var(--accent); }
.link:hover { background: var(--bg-3); }
.muted { color: var(--text-faint); font-size: 12px; }
</style>
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/DataTablePanel.vue
git commit -m "feat(view): add data-table side panel"
```

---

### Task 11: Nav tab + page wiring

**Files:**
- Modify: `app/components/AppShell.vue:4-9`
- Modify: `app/pages/index.vue:5-6,15-20,30-34`

- [ ] **Step 1: Add the nav tab**

In `app/components/AppShell.vue`, add to the `views` array (after the credentials entry, line 8):
```ts
  { id: 'dataTables', icon: '🗄️', label: 'Data Tables' },
```

- [ ] **Step 2: Wire the view + panel into the page**

In `app/pages/index.vue`:

Add import after line 5:
```ts
import { dataTableWorkflows } from '~/composables/useDataTableView'
```

Add the view inside `<ClientOnly>` after the `CredentialsView` line (line 19):
```vue
      <DataTablesView v-else-if="store.view === 'dataTables' && store.graph" />
```

Add the panel after the `CredentialPanel` block (after line 34):
```vue
    <DataTablePanel v-if="store.selectedDataTable && store.view === 'map'"
      :data-table="store.selectedDataTable"
      :workflows="dataTableWorkflows(store.graph, store.selectedDataTable.id)"
      @close="store.selectedDataTableId = null"
      @select="(id) => { store.selectedId = id; store.selectedDataTableId = null }" />
```

- [ ] **Step 3: Run dev server and verify manually**

Run: `npm run dev`, open the app, upload `workflows.json` (or connect API), click the **Data Tables** tab.
Expected: list shows the `Demo` table with `insert`/`rowExists` ops and 1 workflow. Toggle the data-tables overlay in Layers on the map → violet table node appears linked to the workflow; clicking it opens the side panel.

- [ ] **Step 4: Commit**

```bash
git add app/components/AppShell.vue app/pages/index.vue
git commit -m "feat(ui): add data tables tab, view and side panel wiring"
```

---

### Task 12: Layers panel toggle

**Files:**
- Modify: `app/components/LayersPanel.vue:39-40`

- [ ] **Step 1: Add the toggle**

In `app/components/LayersPanel.vue`, in the Overlays group (after the credentials label, line 39), add:
```vue
      <label class="item"><input type="checkbox" v-model="store.visibility.overlays.dataTables" /> Data tables</label>
```

- [ ] **Step 2: Lint + manual check**

Run: `npm run lint`
Expected: no errors. In the running app, the Layers menu now has a "Data tables" checkbox controlling the overlay.

- [ ] **Step 3: Commit**

```bash
git add app/components/LayersPanel.vue
git commit -m "feat(map): add data tables overlay toggle to layers panel"
```

---

## Phase C — API enrichment for credentials + data tables

### Task 13: Best-effort API list fetchers

**Files:**
- Modify: `server/ingest/n8n-client.ts`
- Test: `server/ingest/n8n-client.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `server/ingest/n8n-client.test.ts`:

```ts
import { fetchAllCredentials, fetchAllDataTables } from './n8n-client'

describe('fetchAllCredentials (best-effort)', () => {
  it('paginates and returns items on 200', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(resp(200, { data: [{ id: '1', name: 'A', type: 'githubApi' }], nextCursor: 'c2' }))
      .mockResolvedValueOnce(resp(200, { data: [{ id: '2', name: 'B', type: 'slackApi' }], nextCursor: null }))
    const got = await fetchAllCredentials('https://n8n.example.com', 'key', fetchImpl)
    expect(got?.map(c => c.id)).toEqual(['1', '2'])
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/v1/credentials')
  })

  it('returns null on 403 (missing scope)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(403, {}))
    expect(await fetchAllCredentials('https://h', 'key', fetchImpl)).toBeNull()
  })

  it('returns null on 404 (endpoint absent)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(404, {}))
    expect(await fetchAllCredentials('https://h', 'key', fetchImpl)).toBeNull()
  })

  it('returns null when fetch throws', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('boom'))
    expect(await fetchAllCredentials('https://h', 'key', fetchImpl)).toBeNull()
  })
})

describe('fetchAllDataTables (best-effort)', () => {
  it('returns items on 200', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(200, {
      data: [{ id: 't1', name: 'Demo', projectId: 'p', columns: [{ id: 'c', name: 'name', type: 'string', index: 0 }] }],
      nextCursor: null,
    }))
    const got = await fetchAllDataTables('https://h', 'key', fetchImpl)
    expect(got?.[0]).toMatchObject({ id: 't1', name: 'Demo' })
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/v1/data-tables')
  })

  it('returns null on 403', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(resp(403, {}))
    expect(await fetchAllDataTables('https://h', 'key', fetchImpl)).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- n8n-client`
Expected: FAIL — `fetchAllCredentials`/`fetchAllDataTables` not exported.

- [ ] **Step 3: Implement the best-effort paginator + wrappers**

Append to `server/ingest/n8n-client.ts`:

```ts
export interface ApiCredential {
  id: string; name: string; type: string
  createdAt?: string; updatedAt?: string
}
export interface ApiDataTableColumn { id: string; name: string; type: string; index: number }
export interface ApiDataTable {
  id: string; name: string; projectId?: string | null
  columns?: ApiDataTableColumn[]; createdAt?: string; updatedAt?: string
}

// Enrichment endpoints are optional: a key lacking the list scope returns 403,
// an older n8n returns 404. Neither should fail ingest, so this paginator
// resolves to null on any non-2xx, malformed body, or fetch error.
async function fetchListBestEffort<T>(
  baseUrl: string, apiKey: string, path: string,
  fetchImpl: FetchImpl = safeFetch,
  deadline: AbortSignal = AbortSignal.timeout(TOTAL_DEADLINE_MS),
): Promise<T[] | null> {
  const base = stripTrailingSlash(baseUrl)
  const all: T[] = []
  let cursor: string | undefined
  let page = 0
  try {
    do {
      deadline.throwIfAborted()
      const url = new URL(`${base}${path}`)
      url.searchParams.set('limit', String(PAGE_SIZE))
      if (cursor) url.searchParams.set('cursor', cursor)
      const res = await fetchImpl(url.toString(), {
        headers: { 'X-N8N-API-KEY': apiKey, accept: 'application/json' },
        signal: deadline,
      })
      if (res.status < 200 || res.status >= 300) return null
      let body: { data?: T[]; nextCursor?: string | null } | null = null
      try { body = (await res.json()) as typeof body } catch { return null }
      if (!body || !Array.isArray(body.data)) return null
      all.push(...body.data)
      cursor = body.nextCursor ?? undefined
      page++
      if (page >= PAGE_CAP) break
    } while (cursor)
    return all
  } catch {
    return null
  }
}

export function fetchAllCredentials(
  baseUrl: string, apiKey: string, fetchImpl: FetchImpl = safeFetch,
): Promise<ApiCredential[] | null> {
  return fetchListBestEffort<ApiCredential>(baseUrl, apiKey, '/api/v1/credentials', fetchImpl)
}

export function fetchAllDataTables(
  baseUrl: string, apiKey: string, fetchImpl: FetchImpl = safeFetch,
): Promise<ApiDataTable[] | null> {
  return fetchListBestEffort<ApiDataTable>(baseUrl, apiKey, '/api/v1/data-tables', fetchImpl)
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- n8n-client`
Expected: PASS (all old + new tests).

- [ ] **Step 5: Commit**

```bash
git add server/ingest/n8n-client.ts server/ingest/n8n-client.test.ts
git commit -m "feat(ingest): best-effort fetchers for credentials and data tables"
```

---

### Task 14: Merge inferred + API entities

**Files:**
- Create: `server/parser/merge.ts`
- Test: `server/parser/merge.test.ts`
- Modify: `server/parser/build-graph.ts`

- [ ] **Step 1: Write the failing test**

Create `server/parser/merge.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mergeCredentials, mergeDataTables } from './merge'
import type { CredentialRef, DataTableRef } from '#shared/types/graph'
import type { ApiCredential, ApiDataTable } from '../ingest/n8n-client'

describe('mergeCredentials', () => {
  const inferred: CredentialRef[] = [
    { id: '1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['a'], source: 'inferred' },
  ]
  it('marks matched credentials as both and adds timestamps', () => {
    const api: ApiCredential[] = [{ id: '1', name: 'My API', type: 'httpHeaderAuth', createdAt: 'T1', updatedAt: 'T2' }]
    const got = mergeCredentials(inferred, api)
    expect(got).toContainEqual({ id: '1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['a'],
      source: 'both', createdAt: 'T1', updatedAt: 'T2' })
  })
  it('adds API-only credentials as orphans with empty workflowIds', () => {
    const api: ApiCredential[] = [
      { id: '1', name: 'My API', type: 'httpHeaderAuth' },
      { id: '9', name: 'Unused', type: 'slackApi' },
    ]
    const got = mergeCredentials(inferred, api)
    expect(got.find(c => c.id === '9')).toEqual({ id: '9', name: 'Unused', type: 'slackApi',
      workflowIds: [], source: 'api' })
  })
  it('returns inferred unchanged when api is null', () => {
    expect(mergeCredentials(inferred, null)).toEqual(inferred)
  })
})

describe('mergeDataTables', () => {
  const inferred: DataTableRef[] = [
    { id: 't1', name: 'Demo', projectId: 'p', workflowIds: ['a'], operations: ['insert'], source: 'inferred' },
  ]
  it('enriches matched tables with columns and timestamps and marks both', () => {
    const api: ApiDataTable[] = [{ id: 't1', name: 'Demo', projectId: 'p',
      columns: [{ id: 'c', name: 'name', type: 'string', index: 0 }], createdAt: 'T1', updatedAt: 'T2' }]
    const got = mergeDataTables(inferred, api)
    expect(got[0]).toEqual({ id: 't1', name: 'Demo', projectId: 'p', workflowIds: ['a'], operations: ['insert'],
      source: 'both', columns: [{ name: 'name', type: 'string' }], createdAt: 'T1', updatedAt: 'T2' })
  })
  it('adds API-only tables as orphans', () => {
    const api: ApiDataTable[] = [{ id: 't9', name: 'Orphan', projectId: 'q', columns: [] }]
    const got = mergeDataTables(inferred, api)
    expect(got.find(t => t.id === 't9')).toEqual({ id: 't9', name: 'Orphan', projectId: 'q',
      workflowIds: [], operations: [], source: 'api', columns: [] })
  })
  it('returns inferred unchanged when api is null', () => {
    expect(mergeDataTables(inferred, null)).toEqual(inferred)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- merge`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the merges**

Create `server/parser/merge.ts`:

```ts
import type { CredentialRef, DataTableRef } from '#shared/types/graph'
import type { ApiCredential, ApiDataTable } from '../ingest/n8n-client'

export function mergeCredentials(
  inferred: CredentialRef[], api: ApiCredential[] | null,
): CredentialRef[] {
  if (!api) return inferred
  const byId = new Map<string, CredentialRef>()
  const byTypeName = new Map<string, CredentialRef>()
  const out: CredentialRef[] = inferred.map(c => ({ ...c }))
  for (const c of out) {
    if (c.id) byId.set(c.id, c)
    byTypeName.set(`${c.type}:${c.name}`, c)
  }
  for (const a of api) {
    const match = (a.id && byId.get(a.id)) || byTypeName.get(`${a.type}:${a.name}`)
    if (match) {
      match.source = 'both'
      if (a.createdAt) match.createdAt = a.createdAt
      if (a.updatedAt) match.updatedAt = a.updatedAt
    } else {
      out.push({
        id: a.id ?? null, name: a.name, type: a.type, workflowIds: [], source: 'api',
        ...(a.createdAt ? { createdAt: a.createdAt } : {}),
        ...(a.updatedAt ? { updatedAt: a.updatedAt } : {}),
      })
    }
  }
  return out
}

export function mergeDataTables(
  inferred: DataTableRef[], api: ApiDataTable[] | null,
): DataTableRef[] {
  if (!api) return inferred
  const byId = new Map<string, DataTableRef>()
  const out: DataTableRef[] = inferred.map(t => ({ ...t }))
  for (const t of out) byId.set(t.id, t)
  for (const a of api) {
    const cols = a.columns?.map(c => ({ name: c.name, type: c.type }))
    const match = byId.get(a.id)
    if (match) {
      match.source = 'both'
      if (a.projectId != null) match.projectId = a.projectId
      if (cols) match.columns = cols
      if (a.createdAt) match.createdAt = a.createdAt
      if (a.updatedAt) match.updatedAt = a.updatedAt
    } else {
      out.push({
        id: a.id, name: a.name, projectId: a.projectId ?? null,
        workflowIds: [], operations: [], source: 'api',
        ...(cols ? { columns: cols } : {}),
        ...(a.createdAt ? { createdAt: a.createdAt } : {}),
        ...(a.updatedAt ? { updatedAt: a.updatedAt } : {}),
      })
    }
  }
  return out
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- merge`
Expected: PASS.

- [ ] **Step 5: Accept API lists in buildGraph and set enrichment**

In `server/parser/build-graph.ts`:

Add import after line 14:
```ts
import { mergeCredentials, mergeDataTables } from './merge'
import type { ApiCredential, ApiDataTable } from '../ingest/n8n-client'
```

Extend the `opts` parameter type (line 19):
```ts
  opts: { from?: string; catalog?: NodeCatalog; apiCredentials?: ApiCredential[] | null; apiDataTables?: ApiDataTable[] | null } = {},
```

Replace lines 93-95 (`const credentials = …` through the `return`):
```ts
  const inferredCredentials = extractCredentials(valid)
  const inferredDataTables = extractDataTables(valid)
  const apiCredentials = opts.apiCredentials ?? null
  const apiDataTables = opts.apiDataTables ?? null
  const credentials = mergeCredentials(inferredCredentials, apiCredentials)
  const dataTables = mergeDataTables(inferredDataTables, apiDataTables)

  return {
    nodes, edges: keptEdges, triggerNodes, unresolved, skipped, webhooks, schedules,
    credentials, dataTables,
    enrichment: { credentials: apiCredentials !== null, dataTables: apiDataTables !== null },
  }
```

(Remove the now-duplicated `const dataTables = extractDataTables(valid)` line added in Task 3 — it is replaced by `inferredDataTables` above.)

- [ ] **Step 6: Run parser tests**

Run: `npm test -- parser`
Expected: PASS (build-graph default test still green — no API lists → `enrichment` both false, `source: 'inferred'`).

- [ ] **Step 7: Commit**

```bash
git add server/parser/merge.ts server/parser/merge.test.ts server/parser/build-graph.ts
git commit -m "feat(parser): merge API credential/data-table lists with inferred refs"
```

---

### Task 15: Call best-effort fetchers in the API ingest route

**Files:**
- Modify: `server/api/ingest/api.post.ts:1,27-31`

- [ ] **Step 1: Import the fetchers**

Replace line 1:
```ts
import { fetchAllWorkflows, fetchAllCredentials, fetchAllDataTables } from '../../ingest/n8n-client'
```

- [ ] **Step 2: Fetch enrichment in parallel and pass to buildGraph**

Replace lines 27-31 (inside the `try`):
```ts
    const workflows = await fetchAllWorkflows(baseUrl, apiKey)
    const [catalog, apiCredentials, apiDataTables] = await Promise.all([
      buildCatalog({
        host, cache: diskCatalogCache(), source: instanceCatalogSource(baseUrl, apiKey), bundled,
      }),
      fetchAllCredentials(baseUrl, apiKey),
      fetchAllDataTables(baseUrl, apiKey),
    ])
    return buildGraph(workflows, baseUrl, {
      from: new Date().toISOString(), catalog, apiCredentials, apiDataTables,
    })
```

- [ ] **Step 3: Manual verification against the live instance**

Run: `npm run dev`, connect with your API token. Confirm:
- Credentials tab still lists used credentials; if the key has `credential:list` scope, previously-unused credentials now appear with an **unused** badge.
- Data Tables tab shows column counts and any orphan tables (with `dataTable:list` scope).
- With a key lacking those scopes, both tabs still work (inferred only) — no errors.

- [ ] **Step 4: Commit**

```bash
git add server/api/ingest/api.post.ts
git commit -m "feat(ingest): enrich graph with API credential/data-table lists"
```

---

### Task 16: Orphan badges + scope/upload hints in views

**Files:**
- Modify: `app/composables/useCredentialView.ts`
- Modify: `app/components/CredentialsView.vue`
- (DataTablesView already has the unused badge + upload hint from Task 9)

- [ ] **Step 1: Surface `unused` + `source` in credential rows**

In `app/composables/useCredentialView.ts`, extend `CredentialRow` and the mapping:

```ts
export interface CredentialRow {
  id: string | null; name: string; type: string; displayType: string
  workflowCount: number; workflowIds: string[]
  source: 'api' | 'inferred' | 'both'; unused: boolean
}

export function credentialRows(graph: WorkflowGraph | null): CredentialRow[] {
  if (!graph) return []
  return graph.credentials.map(c => ({
    id: c.id, name: c.name, type: c.type, displayType: prettifyType(c.type),
    workflowCount: c.workflowIds.length, workflowIds: c.workflowIds,
    source: c.source, unused: c.workflowIds.length === 0,
  }))
}
```

- [ ] **Step 2: Update the credential-view test**

In `app/composables/useCredentialView.test.ts` (if present), add `source` and `unused` to expected rows. If no test file exists, create `app/composables/useCredentialView.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { credentialRows } from './useCredentialView'
import type { WorkflowGraph } from '#shared/types/graph'

const graph = {
  nodes: [], edges: [], triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [],
  dataTables: [], enrichment: { credentials: true, dataTables: false },
  credentials: [
    { id: '1', name: 'Used', type: 'httpHeaderAuth', workflowIds: ['a'], source: 'both' as const },
    { id: '2', name: 'Orphan', type: 'slackApi', workflowIds: [], source: 'api' as const },
  ],
} as unknown as WorkflowGraph

describe('credentialRows', () => {
  it('flags orphan credentials as unused', () => {
    const rows = credentialRows(graph)
    expect(rows.find(r => r.id === '2')).toMatchObject({ unused: true, source: 'api' })
    expect(rows.find(r => r.id === '1')).toMatchObject({ unused: false, source: 'both' })
  })
})
```

- [ ] **Step 3: Run to verify pass**

Run: `npm test -- useCredentialView`
Expected: PASS.

- [ ] **Step 4: Add the unused badge + upload hint to CredentialsView**

In `app/components/CredentialsView.vue`:

Add the upload-hint computed in `<script setup>` (after line 24):
```ts
const showUploadHint = computed(() => store.connection === null && rows.value.length > 0)
```

In the template, add the hint above the `<DataTable>` (after `<div class="wrap">`, line 32):
```vue
    <p v-if="showUploadHint" class="hint">Connect with an API token to see unused credentials.</p>
```

In the `#cell-name` slot, after `<strong>{{ row.name }}</strong>` (line 35), add:
```vue
        <Badge v-if="row.unused" class="unused">unused</Badge>
```

Add styles inside `<style scoped>`:
```css
.hint { font-size: 12px; color: var(--text-dim); background: var(--bg-2); border: 1px solid var(--border);
  border-radius: var(--radius-s); padding: 6px 10px; margin: 0 0 10px; }
.unused { margin-left: 8px; background: var(--bg-3); color: var(--text-dim); }
```

- [ ] **Step 5: Add the missing-scope toolbar hint**

In `app/components/Toolbar.vue`, show a subtle note when connected by API but enrichment failed. Add near the existing connection display (use the store): when `store.connection && store.graph && (!store.graph.enrichment.credentials || !store.graph.enrichment.dataTables)`, render:
```vue
    <span v-if="scopeHint" class="scope-hint" :title="scopeHintTitle">⚠ limited API scope</span>
```
with, in `<script setup>`:
```ts
const scopeHint = computed(() => !!store.connection && !!store.graph &&
  (!store.graph.enrichment.credentials || !store.graph.enrichment.dataTables))
const scopeHintTitle = computed(() =>
  'Add credential:list / dataTable:list scopes to this API key to see unused items and extra metadata.')
```
and style:
```css
.scope-hint { font-size: 11px; color: var(--warn); cursor: help; }
```
(Adapt placement to the existing Toolbar markup; this is additive and must not disturb the existing search/connection controls.)

- [ ] **Step 6: Lint + manual check**

Run: `npm run lint && npm test`
Expected: all tests pass, no lint errors. In the app: upload mode shows the connect hint; an API key without list scopes shows the toolbar ⚠ hint; a fully-scoped key shows orphans with unused badges and no warning.

- [ ] **Step 7: Commit**

```bash
git add app/composables/useCredentialView.ts app/composables/useCredentialView.test.ts app/components/CredentialsView.vue app/components/Toolbar.vue
git commit -m "feat(view): orphan badges and scope/upload hints for credentials and data tables"
```

---

## Final verification

- [ ] **Run the full suite**

Run: `npm test && npm run lint`
Expected: all tests pass, no lint errors.

- [ ] **End-to-end manual check**

Run: `npm run dev`. With a scoped API token: Map overlay shows data-table nodes (violet) and credential nodes; Data Tables and Credentials tabs list used + orphan items with badges and column details; side panels open from overlay nodes with working "Open in n8n" deep links. With upload-only JSON: inferred-only data, connect hints visible, no errors.
