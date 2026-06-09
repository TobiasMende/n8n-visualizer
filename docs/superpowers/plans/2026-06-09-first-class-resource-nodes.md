# First-Class Credential & Data-Table Graph Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote credentials and data tables from radial overlay satellites to first-class nodes in the map's dagre layered layout — ranked below their workflows, edge-routed, selectable, dimmed on focus — exactly like trigger nodes; node-types stays an overlay.

**Architecture:** Client-side promotion mirroring `triggerNodes`. A new pure composable `useResourceNodes` derives resource nodes/edges from `graph.credentials`/`graph.dataTables` + visibility flags + the scoped workflow set. `WorkflowMap` feeds them into `computeLayeredLayout` and renders them. Visibility moves credentials/data-tables out of `overlays` into a new `resources` group (data tables default on, credentials off). `overlayNodesAndEdges` shrinks to node-types only.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, Pinia, Vue Flow, dagre, Vitest. Test: `npm test`. Lint: `npm run lint`. Build: `TMPDIR=/tmp npm run build`.

**Spec:** `docs/superpowers/specs/2026-06-09-first-class-resource-nodes-design.md`

> **Note on transient type errors:** Task 3 narrows `visibility.overlays` to `{ nodeTypes }`, which leaves `LayersPanel.vue`, `useMapLayers.ts`, and `WorkflowMap.vue` temporarily referencing removed keys until their tasks (4, 5, 6) land. `npx tsc --noEmit` is only required to be 0 after Task 6. Each intermediate task is verified by its own unit tests.

---

## File Structure

- `app/composables/edgeColors.ts` (modify) — add `credential` color.
- `app/composables/useResourceNodes.ts` (create) + `.test.ts` — pure resource-node derivation.
- `app/composables/useVisibility.ts` (modify) — `resources` group; narrow `overlays`.
- `app/composables/useVisibility.test.ts` (modify) — assert new defaults.
- `app/stores/graph.ts` (modify) — prefs merge for `resources`.
- `app/composables/useMapLayers.ts` (modify) — strip credential/data-table branches.
- `app/composables/useMapLayers.test.ts` (modify) — node-types only.
- `app/components/WorkflowMap.vue` (modify) — wire resources into layout/render/edges/dim.
- `app/components/LayersPanel.vue` (modify) — Resources group; Overlays = node-types only.

---

### Task 1: Add credential edge color

**Files:**
- Modify: `app/composables/edgeColors.ts`

- [ ] **Step 1: Add the color**

In `app/composables/edgeColors.ts`, add `credential` to `EDGE_COLORS` (note `dataTable` already exists):

```ts
export const EDGE_COLORS: Record<string, string> = {
  execute: '#3ddc97',
  webhookHttp: '#10b981',
  error: '#ef4444',
  trigger: '#f5a623',
  dataTable: '#b48cff',
  credential: '#ffb454',
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add app/composables/edgeColors.ts
git commit -m "feat(map): add credential edge color"
```

---

### Task 2: `useResourceNodes` composable

**Files:**
- Create: `app/composables/useResourceNodes.ts`
- Test: `app/composables/useResourceNodes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/composables/useResourceNodes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { resourceNodes } from './useResourceNodes'
import type { WorkflowGraph } from '#shared/types/graph'

const graph = {
  nodes: [
    { id: 'wf1', name: 'A', active: true, triggers: [], tags: [], webhookPaths: [],
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 }, deepLink: null },
    { id: 'wf2', name: 'B', active: true, triggers: [], tags: [], webhookPaths: [],
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 }, deepLink: null },
  ],
  edges: [], triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [],
  credentials: [
    { id: 'c1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['wf1', 'wf2'], source: 'inferred' as const },
    { id: null, name: 'NoId', type: 'slackApi', workflowIds: ['wf1'], source: 'inferred' as const },
  ],
  dataTables: [
    { id: 't1', name: 'Demo', projectId: 'p', workflowIds: ['wf1'], operations: ['insert'], source: 'inferred' as const },
    { id: 't2', name: 'Orphan', projectId: 'p', workflowIds: [], operations: [], source: 'api' as const },
  ],
  enrichment: { credentials: false, dataTables: false },
} as unknown as WorkflowGraph

const all = new Set(['wf1', 'wf2'])

describe('resourceNodes', () => {
  it('emits shared credential nodes with one edge per using-workflow when credentials on', () => {
    const r = resourceNodes(graph, { credentials: true, dataTables: false }, all)
    const shared = r.nodes.find(n => n.label === 'My API')!
    expect(shared).toMatchObject({ id: 'cred:httpHeaderAuth:c1', kind: 'credential', workflowIds: ['wf1', 'wf2'] })
    expect(r.edges.filter(e => e.target === 'cred:httpHeaderAuth:c1').map(e => e.source)).toEqual(['wf1', 'wf2'])
    expect(r.edges.every(e => e.kind === 'credential')).toBe(true)
  })

  it('uses name when credential id is null (matches panel selection id)', () => {
    const r = resourceNodes(graph, { credentials: true, dataTables: false }, all)
    expect(r.nodes.find(n => n.label === 'NoId')!.id).toBe('cred:slackApi:NoId')
  })

  it('emits data-table nodes only when dataTables on, edges directed workflow -> table', () => {
    const r = resourceNodes(graph, { credentials: false, dataTables: true }, all)
    expect(r.nodes.map(n => n.id)).toEqual(['datatable:t1'])
    expect(r.edges).toEqual([{ source: 'wf1', target: 'datatable:t1', kind: 'dataTable' }])
  })

  it('drops a resource whose using-workflows are all out of scope', () => {
    const r = resourceNodes(graph, { credentials: true, dataTables: true }, new Set(['wf2']))
    // My API still has wf2; NoId (wf1 only) and t1 (wf1 only) drop
    expect(r.nodes.map(n => n.id).sort()).toEqual(['cred:httpHeaderAuth:c1'])
    expect(r.edges).toEqual([{ source: 'wf2', target: 'cred:httpHeaderAuth:c1', kind: 'credential' }])
  })

  it('emits nothing when both flags off or graph null', () => {
    expect(resourceNodes(graph, { credentials: false, dataTables: false }, all)).toEqual({ nodes: [], edges: [] })
    expect(resourceNodes(null, { credentials: true, dataTables: true }, all)).toEqual({ nodes: [], edges: [] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useResourceNodes`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the composable**

Create `app/composables/useResourceNodes.ts`:

```ts
import type { WorkflowGraph } from '#shared/types/graph'

export interface ResourceNode {
  id: string
  kind: 'credential' | 'dataTable'
  label: string
  workflowIds: string[]
}
export interface ResourceEdge {
  source: string
  target: string
  kind: 'credential' | 'dataTable'
}

export function resourceNodes(
  graph: WorkflowGraph | null,
  show: { credentials: boolean; dataTables: boolean },
  keep: Set<string>,
): { nodes: ResourceNode[]; edges: ResourceEdge[] } {
  const nodes: ResourceNode[] = []
  const edges: ResourceEdge[] = []
  if (!graph) return { nodes, edges }

  if (show.credentials) {
    for (const c of graph.credentials) {
      const wfs = c.workflowIds.filter(id => keep.has(id))
      if (!wfs.length) continue
      const id = `cred:${c.type}:${c.id ?? c.name}`
      nodes.push({ id, kind: 'credential', label: c.name, workflowIds: wfs })
      for (const wf of wfs) edges.push({ source: wf, target: id, kind: 'credential' })
    }
  }

  if (show.dataTables) {
    for (const t of graph.dataTables) {
      const wfs = t.workflowIds.filter(id => keep.has(id))
      if (!wfs.length) continue
      const id = `datatable:${t.id}`
      nodes.push({ id, kind: 'dataTable', label: t.name, workflowIds: wfs })
      for (const wf of wfs) edges.push({ source: wf, target: id, kind: 'dataTable' })
    }
  }

  return { nodes, edges }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- useResourceNodes`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useResourceNodes.ts app/composables/useResourceNodes.test.ts
git commit -m "feat(map): derive first-class resource nodes from credentials and data tables"
```

---

### Task 3: Visibility `resources` group + store prefs

**Files:**
- Modify: `app/composables/useVisibility.ts`
- Modify: `app/composables/useVisibility.test.ts`
- Modify: `app/stores/graph.ts`

- [ ] **Step 1: Add a failing default-visibility test**

In `app/composables/useVisibility.test.ts`, add inside the file (after the existing `describe('visibleGraph', …)` block):

```ts
describe('defaultVisibility resources', () => {
  it('defaults data tables on, credentials off, node-types overlay off', () => {
    const d = defaultVisibility()
    expect(d.resources).toEqual({ credentials: false, dataTables: true })
    expect(d.overlays).toEqual({ nodeTypes: false })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- useVisibility`
Expected: FAIL — `d.resources` undefined; `d.overlays` still has `credentials`/`dataTables`.

- [ ] **Step 3: Restructure the `Visibility` type + defaults**

In `app/composables/useVisibility.ts`, update the interface `overlays` line and add `resources`:

```ts
export interface Visibility {
  triggerKinds: Record<TriggerKind, boolean>
  hideErrorHandlers: boolean
  linkTypes: Record<'execute' | 'webhookHttp' | 'error', boolean>
  resources: { credentials: boolean; dataTables: boolean }
  overlays: { nodeTypes: boolean }
  hiddenNodeTypes: string[]
}
```

And `defaultVisibility()`:

```ts
export function defaultVisibility(): Visibility {
  return {
    triggerKinds: { webhook: true, schedule: true, manual: true, app: true, form: true },
    hideErrorHandlers: false,
    linkTypes: { execute: true, webhookHttp: true, error: true },
    resources: { credentials: false, dataTables: true },
    overlays: { nodeTypes: false },
    hiddenNodeTypes: [],
  }
}
```

- [ ] **Step 4: Update the store prefs merge**

In `app/stores/graph.ts`, the visibility-restore block builds `visibility.value` from saved prefs. Add a `resources` merge line alongside the existing `overlays` line:

```ts
          visibility.value = {
            triggerKinds: { ...d.triggerKinds, ...(p.visibility.triggerKinds ?? {}) },
            hideErrorHandlers: !!p.visibility.hideErrorHandlers,
            linkTypes: { ...d.linkTypes, ...(p.visibility.linkTypes ?? {}) },
            resources: { ...d.resources, ...(p.visibility.resources ?? {}) },
            overlays: { ...d.overlays, ...(p.visibility.overlays ?? {}) },
            hiddenNodeTypes: Array.isArray(p.visibility.hiddenNodeTypes) ? p.visibility.hiddenNodeTypes : [],
          }
```

(Old persisted `overlays.credentials/dataTables` keys are spread onto `d.overlays` which no longer declares them; TypeScript ignores extra keys at runtime and the values are unused. This is the intended one-time reset.)

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- useVisibility`
Expected: PASS (existing tests + new default test).

> Note: `npx tsc --noEmit` now reports errors in `LayersPanel.vue` / `useMapLayers.ts` / `WorkflowMap.vue` (they still reference `overlays.credentials/dataTables`). Expected — fixed in Tasks 4-6.

- [ ] **Step 6: Commit**

```bash
git add app/composables/useVisibility.ts app/composables/useVisibility.test.ts app/stores/graph.ts
git commit -m "feat(map): add first-class resources visibility group, shrink overlays to node-types"
```

---

### Task 4: Shrink `overlayNodesAndEdges` to node-types

**Files:**
- Modify: `app/composables/useMapLayers.ts`
- Modify: `app/composables/useMapLayers.test.ts`

- [ ] **Step 1: Replace the test file**

Overwrite `app/composables/useMapLayers.test.ts` with the node-types-only version (the credential/data-table cases move to `useResourceNodes.test.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { overlayNodesAndEdges, allNodeTypes } from './useMapLayers'
import type { WorkflowGraph } from '#shared/types/graph'

const graph = {
  nodes: [{ id: 'w', name: 'W', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
    summary: { nodeCount: 2, nodeTypes: [
      { type: 'n8n-nodes-base.set', displayName: 'Set', count: 1 },
      { type: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request', count: 1 },
    ], credentials: [], inbound: 0, outbound: 0 } }],
  edges: [], triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [],
  credentials: [], dataTables: [], enrichment: { credentials: false, dataTables: false },
} as unknown as WorkflowGraph
const basePos = new Map([['w', { x: 0, y: 0 }]])

describe('overlayNodesAndEdges', () => {
  it('adds nothing when node-types layer is off', () => {
    const r = overlayNodesAndEdges(graph, basePos, { nodeTypes: false })
    expect(r.nodes).toEqual([])
    expect(r.edges).toEqual([])
  })

  it('adds node-type nodes + contains edges when nodeTypes layer on', () => {
    const r = overlayNodesAndEdges(graph, basePos, { nodeTypes: true })
    expect(r.nodes.map(n => n.label).sort()).toEqual(['HTTP Request', 'Set'])
    expect(r.edges.every(e => e.kind === 'contains')).toBe(true)
  })

  it('skips node types listed in hiddenNodeTypes', () => {
    const r = overlayNodesAndEdges(graph, basePos, { nodeTypes: true }, ['n8n-nodes-base.set'])
    expect(r.nodes.filter(n => n.kind === 'nodeType').map(n => n.label)).toEqual(['HTTP Request'])
  })
})

describe('allNodeTypes', () => {
  it('returns deduped node types sorted by display name', () => {
    expect(allNodeTypes(graph)).toEqual([
      { type: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request' },
      { type: 'n8n-nodes-base.set', displayName: 'Set' },
    ])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- useMapLayers`
Expected: FAIL — current signature/`OverlayNode.kind` still include credential/dataTable; the `{ nodeTypes: false }` calls error or the removed-branch behavior differs.

- [ ] **Step 3: Strip the credential + data-table branches**

In `app/composables/useMapLayers.ts`:

Narrow `OverlayNode.kind` (line 3):
```ts
export interface OverlayNode { id: string; kind: 'nodeType'; label: string; x: number; y: number }
```

Narrow the `layers` param (line 10):
```ts
  layers: { nodeTypes: boolean },
```

Delete the entire `if (layers.credentials) { … }` block (lines 23-38) and the entire `if (layers.dataTables) { … }` block (lines 40-55). Keep the `if (layers.nodeTypes) { … }` block and `allNodeTypes` unchanged.

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- useMapLayers`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useMapLayers.ts app/composables/useMapLayers.test.ts
git commit -m "refactor(map): reduce overlay layer to node-types only"
```

---

### Task 5: Wire resources into `WorkflowMap`

**Files:**
- Modify: `app/components/WorkflowMap.vue`

- [ ] **Step 1: Import `resourceNodes`**

Add after the `overlayNodesAndEdges` import (line 10):
```ts
import { resourceNodes } from '~/composables/useResourceNodes'
```

- [ ] **Step 2: Derive resources and feed them into the layout**

After the `triggerEdges` computed (line 49), add:
```ts
const resources = computed(() => resourceNodes(
  store.graph,
  store.visibility.resources,
  new Set(scoped.value.nodes.map(n => n.id)),
))
```

Replace the `positions` computed (lines 51-54):
```ts
const positions = computed(() => computeLayeredLayout(
  [...scoped.value.nodes, ...triggerNodes.value, ...resources.value.nodes],
  [...scoped.value.edges, ...triggerEdges.value, ...resources.value.edges],
))
```

- [ ] **Step 3: Update the `overlay` computed to the narrowed signature**

The `overlay` computed (lines 56-60) passes `store.visibility.overlays`, which is now `{ nodeTypes }` — already compatible. No change needed to that call. Confirm it still reads:
```ts
const overlay = computed(() => store.graph
  ? overlayNodesAndEdges(
      { ...store.graph, nodes: scoped.value.nodes, edges: scoped.value.edges },
      positions.value, store.visibility.overlays, store.visibility.hiddenNodeTypes)
  : { nodes: [], edges: [] })
```

- [ ] **Step 4: Render resource nodes**

In the `nodes` computed (lines 69-94), add a `resNodes` array and include it in the return. Replace the `overlayNodes` mapping (lines 89-92) and return (line 93) with:
```ts
  const resNodes: Node[] = resources.value.nodes.map(r => ({
    id: r.id, type: 'workflow', position: positions.value.get(r.id) ?? { x: 0, y: 0 },
    data: {
      kind: r.kind, label: r.label, triggers: [], inbound: 0, outbound: 0, nodeCount: 0,
      dimmed: focused.value && !r.workflowIds.some(w => flow.value.nodeIds.has(w)),
      selected: r.id === store.selectedCredId || r.id === store.selectedDataTableId,
    },
  }))
  const overlayNodes: Node[] = overlay.value.nodes.map(o => ({
    id: o.id, type: 'workflow', position: { x: o.x, y: o.y },
    data: { kind: o.kind, label: o.label, triggers: [], inbound: 0, outbound: 0, nodeCount: 0, dimmed: focused.value, selected: false },
  }))
  return [...base, ...trigNodes, ...resNodes, ...overlayNodes]
```

- [ ] **Step 5: Render resource edges and simplify overlay edges**

In the `edges` computed (lines 96-115), add a `resEdges` array, simplify `overlayEdges` to the node-types case, and update the return. Replace the `overlayEdges` mapping (lines 110-113) and return (line 114) with:
```ts
  const resEdges: Edge[] = resources.value.edges.map(e => ({
    id: `res-edge:${e.source}:${e.target}`, source: e.source, target: e.target, type: 'flow',
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor(e.kind) },
    data: { type: e.kind, dimmed: focused.value && !flow.value.nodeIds.has(e.source), emphasized: false },
  }))
  const overlayEdges: Edge[] = overlay.value.edges.map(o => ({
    id: o.id, source: o.source, target: o.target,
    style: { stroke: '#6aa0ff', strokeDasharray: '4 4', opacity: focused.value ? 0.05 : 0.6 },
  }))
  return [...baseEdges, ...trigEdges, ...resEdges, ...overlayEdges]
```

(`onNodeClick`/`onPaneClick` already route `credential`/`dataTable` kinds and clear sibling selections — unchanged. `miniColor` already maps both kinds — unchanged.)

- [ ] **Step 6: Verify types, lint, build**

Run: `npx tsc --noEmit`
Expected: 0 errors (WorkflowMap no longer references removed overlay keys).

Run: `npm run lint`
Expected: 0 errors.

Run: `TMPDIR=/tmp npm run build`
Expected: build completes.

- [ ] **Step 7: Commit**

```bash
git add app/components/WorkflowMap.vue
git commit -m "feat(map): render credentials and data tables as first-class layout nodes"
```

---

### Task 6: Layers panel Resources group

**Files:**
- Modify: `app/components/LayersPanel.vue`

- [ ] **Step 1: Replace the Overlays group markup**

In `app/components/LayersPanel.vue`, replace the Overlays group block (the `<div class="grp">Overlays</div>` and the three `overlays.*` labels, lines 38-41) with a Resources group plus a node-types-only Overlays group:

```vue
      <div class="grp">Resources</div>
      <label class="item"><input type="checkbox" v-model="store.visibility.resources.dataTables" /> Data tables</label>
      <label class="item"><input type="checkbox" v-model="store.visibility.resources.credentials" /> Credentials</label>

      <div class="grp">Overlays</div>
      <label class="item"><input type="checkbox" v-model="store.visibility.overlays.nodeTypes" /> Node types</label>
```

(The `v-if="store.visibility.overlays.nodeTypes"` sub-list below it is unchanged.)

- [ ] **Step 2: Verify types, lint, full tests, build**

Run: `npx tsc --noEmit`
Expected: 0 errors.

Run: `npm run lint && npm test`
Expected: 0 lint errors; all tests pass.

Run: `TMPDIR=/tmp npm run build`
Expected: build completes.

- [ ] **Step 3: Commit**

```bash
git add app/components/LayersPanel.vue
git commit -m "feat(map): move credentials and data tables into a Resources layers group"
```

---

## Final verification

- [ ] **Full suite + build**

Run: `npm test && npm run lint && npx tsc --noEmit && TMPDIR=/tmp npm run build`
Expected: all tests pass, 0 lint errors, 0 type errors, build completes.

- [ ] **Manual check**

Run `TMPDIR=/tmp npm run dev`, load a graph with a data-table workflow:
- Data-table nodes appear in the layered layout **below** their workflows by default (violet), connected by animated colored edges — not radial satellites.
- Credentials are hidden until toggled on in the **Resources** group of the Layers panel; once on, they appear as first-class orange nodes below their workflows.
- A credential/table used by multiple workflows is a single shared node with one edge per workflow.
- Selecting a workflow dims unrelated resource nodes/edges (like triggers); clicking a resource opens its side panel.
- Node-types overlay still works from the **Overlays** group.
