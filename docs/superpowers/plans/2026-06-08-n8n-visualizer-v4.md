# n8n Visualizer v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the force-directed Map with a readable top-down layered (dagre) layout, add a unified Layers panel to hide/show categories, and make selecting a workflow (on the Map or via a view row) focus + trace its data-flow path.

**Architecture:** Three pure, testable units — `computeLayeredLayout`, `visibleGraph`, `traceFlow` — composed by `WorkflowMap.vue` (visible → layout → focus highlight). The store's scattered toggles collapse into one persisted `visibility` model driving a `LayersPanel`.

**Tech Stack:** Bun, Nuxt 4 (Vue 3, TS, Nitro), Vue Flow, dagre (`@dagrejs/dagre`), Pinia, Vitest + @vue/test-utils.

## Conventions (from v1–v3)
- Nuxt 4 srcDir `app/`. Shared types `shared/types/graph.ts` via `#shared/...`. App `~` = `app/`. Server `server/`.
- Tests beside source; `bun run test -- <path>` / `bun run test`. Build `bun run build`. Dev `bun run dev`.
- Components with unit tests `import { computed, ref } from 'vue'` explicitly.
- Components auto-import by **bare name** (nuxt.config has `components: [{ path: '~/components', pathPrefix: false }]`) — so `DataTable`, `Badge`, `LayersPanel` etc. resolve unprefixed. Keep using bare names.
- All existing 91 tests stay green.

## File Structure
```
package.json                            # MODIFY: + @dagrejs/dagre, - d3-force, - @types/d3-force
app/composables/useLayeredLayout.ts     # NEW (replaces useForceLayout.ts)
app/composables/useForceLayout.ts       # DELETE (+ its test)
app/composables/useVisibility.ts        # NEW: Visibility, defaultVisibility, entryKindOf, visibleGraph
app/composables/useTraceFlow.ts         # NEW: traceFlow
app/composables/useMapLayers.ts         # unchanged (overlayNodesAndEdges, allNodeTypes reused)
app/stores/graph.ts                     # MODIFY: visibility replaces layers/linkTypes/hiddenNodeTypes
app/components/LayersPanel.vue          # NEW (replaces MapLayerToggles.vue + NodeTypeLayerPanel.vue)
app/components/MapLayerToggles.vue      # DELETE
app/components/NodeTypeLayerPanel.vue   # DELETE
app/components/AppShell.vue            # MODIFY: render LayersPanel instead of MapLayerToggles
app/components/Toolbar.vue            # MODIFY: drop the standalone link-type checkbox row
app/components/WorkflowMap.vue        # MODIFY: visibleGraph → layered layout → focus/dim/fit
```

---

# PHASE 1 — Layered layout

## Task 1: dagre layered layout, swapped into the Map

**Files:** add dep; create `app/composables/useLayeredLayout.ts` + test; modify `app/components/WorkflowMap.vue`; delete `app/composables/useForceLayout.ts` + test.

- [ ] **Step 1: Swap dependencies**

Run: `bun add @dagrejs/dagre` then `bun remove d3-force @types/d3-force`

- [ ] **Step 2: Write the failing layout test**

Create `app/composables/useLayeredLayout.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { computeLayeredLayout } from './useLayeredLayout'

describe('computeLayeredLayout', () => {
  it('places every node', () => {
    const pos = computeLayeredLayout([{ id: 'a' }, { id: 'b' }, { id: 'c' }], [{ source: 'a', target: 'b' }])
    expect(pos.size).toBe(3)
    for (const id of ['a', 'b', 'c']) {
      expect(Number.isFinite(pos.get(id)!.x)).toBe(true)
      expect(Number.isFinite(pos.get(id)!.y)).toBe(true)
    }
  })
  it('ranks an entry node above its target (smaller y, top-down)', () => {
    const pos = computeLayeredLayout([{ id: 'entry' }, { id: 'child' }], [{ source: 'entry', target: 'child' }])
    expect(pos.get('entry')!.y).toBeLessThan(pos.get('child')!.y)
  })
  it('ignores edges referencing unknown nodes and self-loops', () => {
    const pos = computeLayeredLayout([{ id: 'a' }], [{ source: 'a', target: 'ghost' }, { source: 'a', target: 'a' }])
    expect(pos.size).toBe(1)
  })
})
```

- [ ] **Step 3: Run it red**

Run: `bun run test -- app/composables/useLayeredLayout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `app/composables/useLayeredLayout.ts`:
```ts
import dagre from '@dagrejs/dagre'

export interface Point { x: number; y: number }
interface LNode { id: string }
interface LEdge { source: string; target: string }

export function computeLayeredLayout(
  nodes: LNode[],
  edges: LEdge[],
  opts: { nodeWidth?: number; nodeHeight?: number } = {},
): Map<string, Point> {
  const w = opts.nodeWidth ?? 170
  const h = opts.nodeHeight ?? 46
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 90, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))

  const ids = new Set(nodes.map(n => n.id))
  for (const n of nodes) g.setNode(n.id, { width: w, height: h })
  for (const e of edges)
    if (e.source !== e.target && ids.has(e.source) && ids.has(e.target)) g.setEdge(e.source, e.target)

  dagre.layout(g)

  const out = new Map<string, Point>()
  for (const n of nodes) {
    const p = g.node(n.id)
    if (p) out.set(n.id, { x: p.x, y: p.y })
  }
  return out
}
```

- [ ] **Step 5: Run it green**

Run: `bun run test -- app/composables/useLayeredLayout.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Swap the Map to layered layout**

In `app/components/WorkflowMap.vue`:
1. Replace the import `import { computeLayout } from '~/composables/useForceLayout'` with `import { computeLayeredLayout } from '~/composables/useLayeredLayout'`.
2. Replace the `positions` computed with:
```ts
const positions = computed(() =>
  store.graph ? computeLayeredLayout(store.graph.nodes, store.graph.edges) : new Map<string, { x: number; y: number }>()
)
```
Leave the rest (overlay, nodes, edges, onNodeClick, template) unchanged for this task.

- [ ] **Step 7: Delete the force layout**

```bash
git rm app/composables/useForceLayout.ts app/composables/useForceLayout.test.ts
```

- [ ] **Step 8: Build + full suite**

Run: `bun run build` (clean) then `bun run test` (all pass; the removed force-layout test is gone, the new layered test present; report count).

- [ ] **Step 9: Commit**

```bash
git add app/composables/useLayeredLayout.ts app/composables/useLayeredLayout.test.ts app/components/WorkflowMap.vue package.json bun.lock
git commit -m "feat: top-down dagre layered layout, replacing force layout"
```

---

# PHASE 2 — Visibility model + Layers panel

## Task 2: Visibility model + visibleGraph (pure)

**Files:** create `app/composables/useVisibility.ts` + test.

- [ ] **Step 1: Write the failing test**

Create `app/composables/useVisibility.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { defaultVisibility, entryKindOf, visibleGraph } from './useVisibility'
import type { WorkflowGraph, WorkflowNode } from '#shared/types/graph'

const node = (id: string, triggers: any[] = []): WorkflowNode => ({
  id, name: id, active: true, triggers, tags: [], webhookPaths: [], deepLink: null,
  summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 },
})

const graph: WorkflowGraph = {
  nodes: [node('hook', ['webhook']), node('sub'), node('handler')],
  edges: [
    { source: 'hook', target: 'sub', type: 'execute' },
    { source: 'hook', target: 'handler', type: 'error' },
  ],
  unresolved: [], skipped: [], webhooks: [], schedules: [], credentials: [],
}

describe('entryKindOf', () => {
  it('returns the workflow entry kind, none for sub-workflows', () => {
    expect(entryKindOf(node('x', ['webhook']))).toBe('webhook')
    expect(entryKindOf(node('x', ['manual', 'schedule']))).toBe('schedule') // priority webhook>schedule>app>manual
    expect(entryKindOf(node('x', []))).toBe('none')
  })
})

describe('visibleGraph', () => {
  it('shows everything with default visibility', () => {
    const r = visibleGraph(graph, defaultVisibility())
    expect(r.nodes.map(n => n.id).sort()).toEqual(['handler', 'hook', 'sub'])
    expect(r.edges).toHaveLength(2)
  })
  it('hides workflows of a hidden trigger kind and prunes their edges', () => {
    const v = defaultVisibility(); v.triggerKinds.webhook = false
    const r = visibleGraph(graph, v)
    expect(r.nodes.map(n => n.id).sort()).toEqual(['handler', 'sub'])
    expect(r.edges).toHaveLength(0)            // both edges started at 'hook'
  })
  it('hides error-handler workflows and error edges when hideErrorHandlers', () => {
    const v = defaultVisibility(); v.hideErrorHandlers = true
    const r = visibleGraph(graph, v)
    expect(r.nodes.map(n => n.id).sort()).toEqual(['hook', 'sub'])
    expect(r.edges.map(e => e.type)).toEqual(['execute'])
  })
  it('filters edges by link type', () => {
    const v = defaultVisibility(); v.linkTypes.error = false
    const r = visibleGraph(graph, v)
    expect(r.edges.map(e => e.type)).toEqual(['execute'])
  })
})
```

- [ ] **Step 2: Run it red**

Run: `bun run test -- app/composables/useVisibility.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/composables/useVisibility.ts`:
```ts
import type { WorkflowGraph, WorkflowNode, TriggerType } from '#shared/types/graph'

export type EntryKind = 'webhook' | 'schedule' | 'manual' | 'app' | 'none'

export interface Visibility {
  triggerKinds: Record<EntryKind, boolean>
  hideErrorHandlers: boolean
  linkTypes: Record<'execute' | 'webhookHttp' | 'error', boolean>
  overlays: { credentials: boolean; nodeTypes: boolean }
  hiddenNodeTypes: string[]
}

export function defaultVisibility(): Visibility {
  return {
    triggerKinds: { webhook: true, schedule: true, manual: true, app: true, none: true },
    hideErrorHandlers: false,
    linkTypes: { execute: true, webhookHttp: true, error: true },
    overlays: { credentials: false, nodeTypes: false },
    hiddenNodeTypes: [],
  }
}

const PRIORITY: TriggerType[] = ['webhook', 'schedule', 'app', 'manual']

export function entryKindOf(node: WorkflowNode): EntryKind {
  for (const k of PRIORITY) if (node.triggers.includes(k)) return k as EntryKind
  return 'none'
}

export function errorHandlerIds(graph: WorkflowGraph): Set<string> {
  const s = new Set<string>()
  for (const e of graph.edges) if (e.type === 'error') s.add(e.target)
  return s
}

export function visibleGraph(graph: WorkflowGraph, v: Visibility): {
  nodes: WorkflowNode[]; edges: WorkflowGraph['edges']
} {
  const handlers = errorHandlerIds(graph)
  const nodes = graph.nodes.filter(n => {
    if (!v.triggerKinds[entryKindOf(n)]) return false
    if (v.hideErrorHandlers && handlers.has(n.id)) return false
    return true
  })
  const ids = new Set(nodes.map(n => n.id))
  const edges = graph.edges.filter(e =>
    v.linkTypes[e.type] && ids.has(e.source) && ids.has(e.target))
  return { nodes, edges }
}
```

- [ ] **Step 4: Run it green**

Run: `bun run test -- app/composables/useVisibility.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useVisibility.ts app/composables/useVisibility.test.ts
git commit -m "feat: visibility model and visibleGraph projection"
```

---

## Task 3: Visibility cutover — store, Map, LayersPanel, shell, toolbar

**Files:** create `app/components/LayersPanel.vue`; modify `app/stores/graph.ts`, `app/components/WorkflowMap.vue`, `app/components/AppShell.vue`, `app/components/Toolbar.vue`; delete `app/components/MapLayerToggles.vue`, `app/components/NodeTypeLayerPanel.vue`. Build-verified (logic already tested in T2).

This is one cohesive cutover so the build stays green. Do all edits, then build.

- [ ] **Step 1: Store — replace toggles with `visibility`**

In `app/stores/graph.ts`:
1. Add import: `import { defaultVisibility, type Visibility } from '~/composables/useVisibility'`
2. Remove the `layers`, `linkTypes`, and `hiddenNodeTypes` refs. Add: `const visibility = ref<Visibility>(defaultVisibility())`
3. In the prefs hydration `try` block, replace the per-field reads for the removed refs with a tolerant merge:
```ts
        if (p.visibility && typeof p.visibility === 'object') {
          const d = defaultVisibility()
          visibility.value = {
            triggerKinds: { ...d.triggerKinds, ...(p.visibility.triggerKinds ?? {}) },
            hideErrorHandlers: !!p.visibility.hideErrorHandlers,
            linkTypes: { ...d.linkTypes, ...(p.visibility.linkTypes ?? {}) },
            overlays: { ...d.overlays, ...(p.visibility.overlays ?? {}) },
            hiddenNodeTypes: Array.isArray(p.visibility.hiddenNodeTypes) ? p.visibility.hiddenNodeTypes : [],
          }
        }
```
   (Keep the `view` and `tagFilter` hydration lines; drop `layers`/`linkTypes`/`hiddenNodeTypes` lines.)
4. Change the persistence `watch` to `watch([view, tagFilter, visibility], ...)` and serialize `{ view: view.value, tagFilter: tagFilter.value, visibility: visibility.value }`.
5. In `disconnect()`, the `view.value = 'map'` stays; no visibility reset needed.
6. Replace `layers`/`linkTypes`/`hiddenNodeTypes` in the returned object with `visibility`.

- [ ] **Step 2: Map — render the visible, laid-out, overlaid graph**

Replace the `<script setup>` of `app/components/WorkflowMap.vue` with:
```ts
import { computed } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import type { Edge, Node } from '@vue-flow/core'
import { computeLayeredLayout } from '~/composables/useLayeredLayout'
import { matchesTags } from '~/composables/useTagFilter'
import { overlayNodesAndEdges } from '~/composables/useMapLayers'
import { visibleGraph } from '~/composables/useVisibility'
import { useGraphStore } from '~/stores/graph'

const store = useGraphStore()

const edgeStyle: Record<string, Record<string, any>> = {
  execute: { stroke: '#3b82f6' },
  webhookHttp: { stroke: '#10b981', strokeDasharray: '6 4' },
  error: { stroke: '#ef4444' },
}

const visible = computed(() => store.graph
  ? visibleGraph(store.graph, store.visibility)
  : { nodes: [], edges: [] })

const positions = computed(() => computeLayeredLayout(visible.value.nodes, visible.value.edges))

const overlay = computed(() => store.graph
  ? overlayNodesAndEdges(
      { ...store.graph, nodes: visible.value.nodes, edges: visible.value.edges },
      positions.value, store.visibility.overlays, store.visibility.hiddenNodeTypes)
  : { nodes: [], edges: [] })

const nodes = computed<Node[]>(() => {
  const base: Node[] = visible.value.nodes.map(n => ({
    id: n.id, type: 'workflow', position: positions.value.get(n.id) ?? { x: 0, y: 0 },
    data: { kind: 'workflow', label: n.name, triggers: n.triggers, inbound: n.summary.inbound, dimmed: !matchesTags(n, store.tagFilter) },
  }))
  const overlayNodes: Node[] = overlay.value.nodes.map(o => ({
    id: o.id, type: 'workflow', position: { x: o.x, y: o.y },
    data: { kind: o.kind, label: o.label, triggers: [], inbound: 0, dimmed: false },
  }))
  return [...base, ...overlayNodes]
})

const edges = computed<Edge[]>(() => {
  const baseEdges: Edge[] = visible.value.edges.map(e => ({
    id: `${e.source}|${e.target}|${e.type}`, source: e.source, target: e.target,
    animated: e.type === 'webhookHttp', style: edgeStyle[e.type],
  }))
  const overlayEdges: Edge[] = overlay.value.edges.map(o => ({
    id: o.id, source: o.source, target: o.target,
    style: { stroke: o.kind === 'uses' ? '#ffb454' : '#6aa0ff', strokeDasharray: '4 4', opacity: 0.6 },
  }))
  return [...baseEdges, ...overlayEdges]
})

function onNodeClick({ node }: { node: Node }) {
  if (node.data?.kind === 'workflow') store.selectedId = node.id
}
```
(The `overlayNodesAndEdges` 3rd arg now takes `store.visibility.overlays` — same `{credentials, nodeTypes}` shape it already expects. The template is unchanged.)

- [ ] **Step 3: Create LayersPanel**

Create `app/components/LayersPanel.vue`:
```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useGraphStore } from '~/stores/graph'
import { allNodeTypes } from '~/composables/useMapLayers'
import type { EntryKind } from '~/composables/useVisibility'

const store = useGraphStore()
const open = ref(false)

const triggerLabels: Record<EntryKind, string> = {
  webhook: 'Webhook', schedule: 'Schedule', manual: 'Manual', app: 'App', none: 'Sub-workflow',
}
const linkLabels: Record<string, string> = { execute: 'Execute', webhookHttp: 'Webhook → HTTP', error: 'Error' }
const types = computed(() => allNodeTypes(store.graph))

function typeVisible(t: string) { return !store.visibility.hiddenNodeTypes.includes(t) }
function toggleType(t: string) {
  const h = store.visibility.hiddenNodeTypes
  store.visibility.hiddenNodeTypes = h.includes(t) ? h.filter(x => x !== t) : [...h, t]
}
</script>

<template>
  <div class="layers">
    <IconButton :active="open" title="Layers" @click="open = !open">☰ Layers</IconButton>
    <div v-if="open" class="panel">
      <div class="grp">Workflows</div>
      <label v-for="(label, kind) in triggerLabels" :key="kind" class="item">
        <input type="checkbox" v-model="store.visibility.triggerKinds[kind]" /> {{ label }}
      </label>
      <label class="item"><input type="checkbox" v-model="store.visibility.hideErrorHandlers" /> Hide error handlers</label>

      <div class="grp">Edges</div>
      <label v-for="(label, t) in linkLabels" :key="t" class="item">
        <input type="checkbox" v-model="store.visibility.linkTypes[t]" /> {{ label }}
      </label>

      <div class="grp">Overlays</div>
      <label class="item"><input type="checkbox" v-model="store.visibility.overlays.credentials" /> Credentials</label>
      <label class="item"><input type="checkbox" v-model="store.visibility.overlays.nodeTypes" /> Node types</label>
      <div v-if="store.visibility.overlays.nodeTypes" class="sub">
        <label v-for="t in types" :key="t.type" class="item">
          <input type="checkbox" :checked="typeVisible(t.type)" @change="toggleType(t.type)" /> {{ t.displayName }}
        </label>
        <p v-if="!types.length" class="empty">No node types.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layers { position: relative; }
.panel { position: absolute; top: 100%; right: 0; margin-top: 6px; width: 250px; max-height: 70vh; overflow: auto;
  background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-m); box-shadow: var(--shadow-1);
  padding: 8px; z-index: 30; }
.grp { color: var(--text-dim); text-transform: uppercase; font-size: 10px; letter-spacing: .05em; margin: 8px 2px 4px; }
.grp:first-child { margin-top: 0; }
.item { display: flex; align-items: center; gap: 8px; padding: 3px 2px; font-size: 13px; color: var(--text); cursor: pointer; }
.sub { margin-left: 14px; border-left: 1px solid var(--border-soft); padding-left: 8px; }
.empty { color: var(--text-faint); font-size: 12px; }
</style>
```

- [ ] **Step 4: AppShell — render LayersPanel**

In `app/components/AppShell.vue`, replace `<MapLayerToggles v-if="store.view === 'map' && store.graph" />` with `<LayersPanel v-if="store.view === 'map' && store.graph" />`.

- [ ] **Step 5: Toolbar — drop the standalone link-type row**

In `app/components/Toolbar.vue`, remove the link-type filter block (the `<div v-if="store.graph" class="row">` containing the `v-for="(on, type) in store.linkTypes"` label loop) — link types now live in the LayersPanel. Leave the search row, tags row, and unresolved row untouched. (This also removes the now-broken `store.linkTypes` reference.)

- [ ] **Step 6: Remove the superseded components**

```bash
git rm app/components/MapLayerToggles.vue app/components/NodeTypeLayerPanel.vue
```

- [ ] **Step 7: Build + full suite**

Run: `bun run build` (clean — no dangling `store.layers`/`store.linkTypes`/`store.hiddenNodeTypes` refs) then `bun run test` (all pass; report count).

- [ ] **Step 8: Commit**

```bash
git add app/stores/graph.ts app/components/WorkflowMap.vue app/components/LayersPanel.vue app/components/AppShell.vue app/components/Toolbar.vue
git commit -m "feat: unified visibility model + Layers panel; Map renders visible laid-out graph"
```

---

# PHASE 3 — Focus + trace flow

## Task 4: traceFlow (pure)

**Files:** create `app/composables/useTraceFlow.ts` + test.

- [ ] **Step 1: Write the failing test**

Create `app/composables/useTraceFlow.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { traceFlow } from './useTraceFlow'

const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'x' }]
const edges = [
  { source: 'a', target: 'b' },   // a → b → c
  { source: 'b', target: 'c' },
  { source: 'd', target: 'b' },   // d → b (upstream of b)
]

describe('traceFlow', () => {
  it('returns selected + upstream + downstream', () => {
    const r = traceFlow(nodes, edges, 'b')
    expect([...r.nodeIds].sort()).toEqual(['a', 'b', 'c', 'd'])   // x excluded
  })
  it('includes edges among the flow nodes', () => {
    const r = traceFlow(nodes, edges, 'b')
    expect(r.edgeIds.has('a|b')).toBe(true)
    expect(r.edgeIds.has('b|c')).toBe(true)
    expect(r.edgeIds.has('d|b')).toBe(true)
  })
  it('terminates on a cycle and returns empty for null/absent', () => {
    const cyc = traceFlow([{ id: 'p' }, { id: 'q' }], [{ source: 'p', target: 'q' }, { source: 'q', target: 'p' }], 'p')
    expect([...cyc.nodeIds].sort()).toEqual(['p', 'q'])
    expect(traceFlow(nodes, edges, null).nodeIds.size).toBe(0)
    expect(traceFlow(nodes, edges, 'missing').nodeIds.size).toBe(0)
  })
})
```
(Edge id convention is `${source}|${target}` here — the flow only needs source/target identity; the Map maps these onto its real edge ids.)

- [ ] **Step 2: Run it red**

Run: `bun run test -- app/composables/useTraceFlow.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/composables/useTraceFlow.ts`:
```ts
interface FNode { id: string }
interface FEdge { source: string; target: string }

export function traceFlow(
  nodes: FNode[], edges: FEdge[], selectedId: string | null,
): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  if (!selectedId || !nodes.some(n => n.id === selectedId)) return { nodeIds, edgeIds }

  const walk = (start: string, dir: 'down' | 'up') => {
    const stack = [start]
    const seen = new Set<string>([start])
    while (stack.length) {
      const cur = stack.pop()!
      nodeIds.add(cur)
      for (const e of edges) {
        const next = dir === 'down' ? (e.source === cur ? e.target : null)
                                    : (e.target === cur ? e.source : null)
        if (next && !seen.has(next)) { seen.add(next); stack.push(next) }
      }
    }
  }
  walk(selectedId, 'down')
  walk(selectedId, 'up')

  for (const e of edges)
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) edgeIds.add(`${e.source}|${e.target}`)

  return { nodeIds, edgeIds }
}
```

- [ ] **Step 4: Run it green**

Run: `bun run test -- app/composables/useTraceFlow.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/composables/useTraceFlow.ts app/composables/useTraceFlow.test.ts
git commit -m "feat: traceFlow upstream+downstream path resolver"
```

---

## Task 5: Map focus — highlight, dim, fit, pane-reset

**Files:** modify `app/components/WorkflowMap.vue`. Build-verified.

- [ ] **Step 1: Wire focus into the Map**

In `app/components/WorkflowMap.vue` `<script setup>`:
1. Add imports:
```ts
import { watch } from 'vue'
import { useVueFlow } from '@vue-flow/core'
import { traceFlow } from '~/composables/useTraceFlow'
```
2. After `const store = useGraphStore()`, add the Vue Flow handle (it must match the same flow instance; `useVueFlow()` with no id inside a `<VueFlow>` subtree shares context — to be safe, give the `<VueFlow>` an explicit `id` and pass it):
```ts
const FLOW_ID = 'main'
const { fitView } = useVueFlow(FLOW_ID)
```
3. Add a `flow` computed and apply dimming. Compute the flow over the VISIBLE set:
```ts
const flow = computed(() => traceFlow(visible.value.nodes, visible.value.edges, store.selectedId))
const focused = computed(() => store.selectedId != null && flow.value.nodeIds.size > 0)
```
4. In the `nodes` computed, set `dimmed` to account for focus (replace the base node `dimmed` expression):
```ts
    data: { kind: 'workflow', label: n.name, triggers: n.triggers, inbound: n.summary.inbound,
            dimmed: !matchesTags(n, store.tagFilter) || (focused.value && !flow.value.nodeIds.has(n.id)),
            selected: store.selectedId === n.id },
```
   and for overlay nodes set `dimmed: focused.value` (overlays dim during focus), `selected: false`.
5. In the `edges` computed, dim base edges outside the flow:
```ts
  const baseEdges: Edge[] = visible.value.edges.map(e => {
    const inFlow = !focused.value || flow.value.edgeIds.has(`${e.source}|${e.target}`)
    return {
      id: `${e.source}|${e.target}|${e.type}`, source: e.source, target: e.target,
      animated: e.type === 'webhookHttp',
      style: { ...edgeStyle[e.type], opacity: inFlow ? 1 : 0.12 },
    }
  })
```
   and overlay edges: `opacity: focused.value ? 0.05 : 0.6`.
6. Add a pane-click handler to clear selection, and a watcher to fit the view to the flow when selection changes:
```ts
function onPaneClick() { store.selectedId = null }

watch(() => store.selectedId, (id) => {
  if (id && flow.value.nodeIds.size) {
    const ids = [...flow.value.nodeIds]
    try { fitView({ nodes: ids.map(i => ({ id: i })), padding: 0.3, duration: 400 }) }
    catch { fitView({ padding: 0.2 }) }   // fallback if node-filtered fitView is unsupported
  }
})
```

- [ ] **Step 2: Pass the flow id + pane handler to the template**

In the `<template>`, update the `<VueFlow>` tag:
```vue
  <VueFlow :id="FLOW_ID" :nodes="nodes" :edges="edges" fit-view-on-init
           @node-click="onNodeClick" @pane-click="onPaneClick">
```

- [ ] **Step 3: Reflect `selected` in the node card**

In `app/components/WorkflowNodeCard.vue`, the `data` prop gains an optional `selected`. Add `selected?: boolean` to the prop's data type and a class binding so the selected node is accented:
```vue
  <div class="node" :class="[`kind-${data.kind}`, { dimmed: data.dimmed, selected: data.selected }]" ...>
```
and in `<style scoped>` add:
```css
.node.selected { border-color: var(--accent); box-shadow: var(--shadow-glow); }
```
(Leave the rest of the component untouched. The unit test still passes — `selected` is optional and unused there.)

- [ ] **Step 4: Build + full suite**

Run: `bun run build` (clean) then `bun run test` (all pass; report count). Note that the visual focus/dim/pan behavior itself is manual browser verification.

- [ ] **Step 5: Commit**

```bash
git add app/components/WorkflowMap.vue app/components/WorkflowNodeCard.vue
git commit -m "feat: focus + trace-flow highlight/dim/fit on selection, pane-click reset"
```

---

## Task 6: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full suite** — `bun run test` → all pass; report count.
- [ ] **Step 2: Build** — `bun run build` → clean.
- [ ] **Step 3: Data-path e2e** (proves layered layout + visibility don't break ingest):
```bash
TMPDIR=/tmp bun run dev > /tmp/v4-e2e.log 2>&1 &
DEV=$!
for i in $(seq 1 40); do curl -s http://localhost:3000/ >/dev/null 2>&1 && break; sleep 1; done
curl -s -o /dev/null -w "index=%{http_code}\n" http://localhost:3000/
curl -s -X POST http://localhost:3000/api/ingest/upload -H 'content-type: application/json' \
  -d '{"baseUrl":"https://n8n.example.com","workflows":[
    {"id":"A","name":"Entry","active":true,"nodes":[{"name":"h","type":"n8n-nodes-base.webhook","parameters":{"path":"x"}},{"name":"c","type":"n8n-nodes-base.executeWorkflow","parameters":{"workflowId":"B"}}]},
    {"id":"B","name":"Sub","nodes":[{"name":"s","type":"n8n-nodes-base.set"}]}
  ]}' | python3 -c "import sys,json;d=json.load(sys.stdin);print('nodes',len(d['nodes']),'edges',[e['type'] for e in d['edges']])"
kill $DEV 2>/dev/null
```
Expected: `index=200`; `nodes 2 edges ['execute']`. State clearly that the layered layout, Layers-panel hide/show, and focus/trace-flow pan-zoom-dim are **manual browser checks**.
- [ ] **Step 4:** No commit (verification only).

---

## Self-Review Notes
- **Spec coverage:** Layered layout — T1 (dagre, swap, force removed). Visibility model + Layers panel — T2 (`visibleGraph`/`entryKindOf`/default), T3 (store cutover, LayersPanel with Workflows/Edges/Overlays incl. per-type, AppShell+Toolbar rewire, old components removed). Focus + trace flow — T4 (`traceFlow` up+down+cycle), T5 (dim/highlight/fitView/pane-reset, selected node accent). Cross-view rows already set `selectedId`+`view` (v2/v3) so they land focused via T5's selection watcher.
- **Type consistency:** `Visibility`/`EntryKind`/`defaultVisibility` defined once in `useVisibility.ts` (T2), consumed by store (T3), LayersPanel (T3), Map (T3/T5). `overlayNodesAndEdges` still takes `{credentials,nodeTypes}` + `hiddenNodeTypes` — fed from `store.visibility.overlays`/`.hiddenNodeTypes`. `computeLayeredLayout(nodes, edges)` signature stable across T1/T3/T5. `traceFlow` edge-id convention `source|target` is internal to the flow and mapped onto real ids in the Map.
- **Regressions handled:** removing `store.layers`/`linkTypes`/`hiddenNodeTypes` — every reader updated in T3 (Map, Toolbar, AppShell) and the two old components deleted; build gate catches stragglers. Removing d3-force — only `useForceLayout.ts` used it; deleted with its test (T1). `WorkflowNodeCard` gains optional `selected` (T5) — existing spec stays green.
- **Placeholder scan:** none. The `fitView`-by-nodes fallback (T5) is explicit (try/catch to a plain fitView), not a vague step. Visual behaviors are flagged as manual checks, not skipped assertions.
