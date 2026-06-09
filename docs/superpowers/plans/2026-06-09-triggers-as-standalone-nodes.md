# Triggers as Standalone Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote n8n triggers from a corner badge on each workflow card to first-class, standalone graph nodes that point at the workflow they fire.

**Architecture:** `buildGraph` (server) emits a new `triggerNodes: TriggerNode[]` array — one entry per real trigger node in each workflow (rich: per webhook path, per schedule cadence), excluding `executeWorkflowTrigger`. The frontend feeds these into the dagre layout and VueFlow so each trigger sits upstream of its workflow, connected by a derived `trigger`-typed edge. The corner trigger badge is removed from the graph card. `WorkflowNode.triggers` is kept (still used by `SidePanel`), but the `executeWorkflowTrigger`→`app` misclassification is fixed.

**Tech Stack:** TypeScript, Nuxt 3 / Vue 3, Pinia, VueFlow, dagre, Vitest.

---

## File Structure

- `shared/types/graph.ts` — add `TriggerKind`, `TriggerNode`; add `triggerNodes` to `WorkflowGraph`; add `'trigger'` to `LinkType`.
- `server/parser/triggers.ts` — fix `classifyTriggers`; add `extractTriggerNodes`.
- `server/parser/build-graph.ts` — collect and emit `triggerNodes`.
- `app/composables/useVisibility.ts` — `triggerKinds` filters trigger nodes (not workflows); remove `entryKindOf`/`EntryKind`.
- `app/composables/edgeColors.ts` — add `trigger` color.
- `app/components/WorkflowMap.vue` — merge trigger nodes + derived trigger edges into layout and VueFlow.
- `app/components/WorkflowNodeCard.vue` — add `kind: 'trigger'`; remove corner badge + entryKind.
- `app/components/LayersPanel.vue` — retitle trigger filter group + update label keys.
- `app/stores/graph.ts` — persistence merge for new `triggerKinds` keys.
- Tests: `server/parser/triggers.test.ts`, `server/parser/build-graph.test.ts`, `app/composables/useVisibility.test.ts`.

---

## Task 1: Shared types

**Files:**
- Modify: `shared/types/graph.ts:1-2`, `:69`, `:73-81`

- [ ] **Step 1: Add trigger types and extend graph/link types**

In `shared/types/graph.ts`, change line 2 from:

```ts
export type LinkType = 'execute' | 'webhookHttp' | 'error'
```
to:
```ts
export type LinkType = 'execute' | 'webhookHttp' | 'error' | 'trigger'
export type TriggerKind = 'webhook' | 'schedule' | 'manual' | 'app' | 'form'
```

After the `WorkflowEdge` interface (line 69), add:

```ts
export interface TriggerNode {
  id: string
  workflowId: string
  kind: TriggerKind
  label: string
}
```

In `WorkflowGraph` (lines 73-81), add the `triggerNodes` field:

```ts
export interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  triggerNodes: TriggerNode[]
  unresolved: UnresolvedLink[]
  skipped: SkippedWorkflow[]
  webhooks: WebhookEntry[]
  schedules: ScheduleEntry[]
  credentials: CredentialRef[]
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/tobi/Projekte/n8n-visuzalizer && npx tsc --noEmit`
Expected: errors only in files that construct `WorkflowGraph` without `triggerNodes` (build-graph.ts, tests, useVisibility.test.ts). These are fixed in later tasks. No errors in `shared/types/graph.ts` itself.

- [ ] **Step 3: Commit**

```bash
git add shared/types/graph.ts
git commit -m "feat(types): add TriggerNode and trigger link type"
```

---

## Task 2: Server — fix classification + extract trigger nodes

**Files:**
- Modify: `server/parser/triggers.ts`
- Test: `server/parser/triggers.test.ts`

- [ ] **Step 1: Write failing tests for `extractTriggerNodes`**

Append to `server/parser/triggers.test.ts` (and add the import on line 2):

```ts
import { classifyTriggers, extractTriggerNodes } from './triggers'
```

Add these `describe` blocks at the end of the file:

```ts
const wfFull = (nodes: any[]): RawWorkflow => ({ id: 'w1', name: 'W', nodes })

describe('classifyTriggers — executeWorkflowTrigger', () => {
  it('does NOT classify executeWorkflowTrigger as an app trigger', () => {
    expect(classifyTriggers(wf([{ type: 'n8n-nodes-base.executeWorkflowTrigger' }]))).toEqual([])
  })
})

describe('extractTriggerNodes', () => {
  const cat = { displayName: (t: string) => t.split('.').pop() ?? t }

  it('emits a webhook trigger node with method + path label', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'orders', httpMethod: 'POST' } },
    ]), cat)
    expect(got).toEqual([
      { id: 'trig:w1:hook#0', workflowId: 'w1', kind: 'webhook', label: 'POST /orders' },
    ])
  })

  it('emits one schedule trigger node per cadence', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'cron', type: 'n8n-nodes-base.scheduleTrigger', parameters: { rule: { interval: [
        { field: 'days', triggerAtHour: 9, triggerAtMinute: 0 },
      ] } } },
    ]), cat)
    expect(got).toEqual([
      { id: 'trig:w1:cron#0', workflowId: 'w1', kind: 'schedule', label: 'Every day at 09:00' },
    ])
  })

  it('emits a manual trigger node', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'm', type: 'n8n-nodes-base.manualTrigger' },
    ]), cat)
    expect(got).toEqual([{ id: 'trig:w1:m#0', workflowId: 'w1', kind: 'manual', label: 'Manual' }])
  })

  it('emits an app trigger node using the catalog display name', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 's', type: 'n8n-nodes-base.slackTrigger' },
    ]), cat)
    expect(got).toEqual([{ id: 'trig:w1:s#0', workflowId: 'w1', kind: 'app', label: 'slackTrigger' }])
  })

  it('emits a form trigger node', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'f', type: 'n8n-nodes-base.formTrigger', parameters: { path: 'signup' } },
    ]), cat)
    expect(got).toEqual([{ id: 'trig:w1:f#0', workflowId: 'w1', kind: 'form', label: 'Form /signup' }])
  })

  it('excludes executeWorkflowTrigger and non-trigger nodes', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'sub', type: 'n8n-nodes-base.executeWorkflowTrigger' },
      { name: 'set', type: 'n8n-nodes-base.set' },
    ]), cat)
    expect(got).toEqual([])
  })

  it('emits multiple trigger nodes for one workflow', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'a', httpMethod: 'GET' } },
      { name: 'm', type: 'n8n-nodes-base.manualTrigger' },
    ]), cat)
    expect(got.map(t => t.kind)).toEqual(['webhook', 'manual'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/tobi/Projekte/n8n-visuzalizer && npx vitest run server/parser/triggers.test.ts`
Expected: FAIL — `extractTriggerNodes` is not exported; the executeWorkflowTrigger test fails because it currently returns `['app']`.

- [ ] **Step 3: Implement the fix + extractor**

Replace the entire contents of `server/parser/triggers.ts` with:

```ts
import type { RawWorkflow, RawNode, TriggerType, TriggerNode } from '#shared/types/graph'
import type { NodeCatalog } from '../catalog/catalog'
import { webhookNodeInfo } from '../webhooks/extract'
import { parseSchedule } from '../schedule/parse'

const SCHEDULE = new Set([
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.cron',
  'n8n-nodes-base.interval',
])

const EXECUTE_TRIGGER = 'n8n-nodes-base.executeWorkflowTrigger'

export function classifyTriggers(wf: RawWorkflow): TriggerType[] {
  const set = new Set<TriggerType>()
  for (const node of wf.nodes ?? []) {
    const t = node.type
    if (t === EXECUTE_TRIGGER) continue
    if (t === 'n8n-nodes-base.webhook') set.add('webhook')
    else if (SCHEDULE.has(t)) set.add('schedule')
    else if (t === 'n8n-nodes-base.manualTrigger') set.add('manual')
    else if (t.endsWith('Trigger')) set.add('app')
  }
  return [...set]
}

function push(out: TriggerNode[], wfId: string, name: string, i: number, kind: TriggerNode['kind'], label: string) {
  out.push({ id: `trig:${wfId}:${name}#${i}`, workflowId: wfId, kind, label })
}

export function extractTriggerNodes(wf: RawWorkflow, catalog: NodeCatalog): TriggerNode[] {
  const out: TriggerNode[] = []
  for (const node of wf.nodes ?? []) {
    const t = node.type
    if (t === EXECUTE_TRIGGER) continue

    if (t === 'n8n-nodes-base.formTrigger') {
      const info = webhookNodeInfo(node as RawNode)
      push(out, wf.id, node.name, 0, 'form', info ? `Form /${info.path}` : 'Form')
    } else if (t === 'n8n-nodes-base.webhook') {
      const info = webhookNodeInfo(node as RawNode)
      push(out, wf.id, node.name, 0, 'webhook', info ? `${info.method} /${info.path}` : 'Webhook')
    } else if (SCHEDULE.has(t)) {
      const cadences = parseSchedule(node as RawNode)
      if (cadences.length === 0) push(out, wf.id, node.name, 0, 'schedule', catalog.displayName(t))
      else cadences.forEach((c, i) => push(out, wf.id, node.name, i, 'schedule', c.cadenceText))
    } else if (t === 'n8n-nodes-base.manualTrigger') {
      push(out, wf.id, node.name, 0, 'manual', 'Manual')
    } else if (t.endsWith('Trigger')) {
      push(out, wf.id, node.name, 0, 'app', catalog.displayName(t))
    }
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/tobi/Projekte/n8n-visuzalizer && npx vitest run server/parser/triggers.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add server/parser/triggers.ts server/parser/triggers.test.ts
git commit -m "feat(parser): extractTriggerNodes + fix executeWorkflowTrigger classification"
```

---

## Task 3: Server — emit triggerNodes from buildGraph

**Files:**
- Modify: `server/parser/build-graph.ts`
- Test: `server/parser/build-graph.test.ts`

- [ ] **Step 1: Write a failing test**

Add to `server/parser/build-graph.test.ts` inside the `describe('buildGraph', ...)` block:

```ts
  it('emits standalone trigger nodes pointing at their workflow', () => {
    const g = buildGraph([producer, consumer], null)
    const trigs = g.triggerNodes.filter(t => t.workflowId === 'p')
    expect(trigs).toHaveLength(1)
    expect(trigs[0]).toMatchObject({ workflowId: 'p', kind: 'webhook', label: 'GET /orders' })
  })

  it('does not emit a trigger node for executeWorkflowTrigger workflows', () => {
    const sub: RawWorkflow = { id: 's', name: 'Sub', nodes: [
      { name: 't', type: 'n8n-nodes-base.executeWorkflowTrigger' },
    ] }
    const g = buildGraph([sub], null)
    expect(g.triggerNodes).toHaveLength(0)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tobi/Projekte/n8n-visuzalizer && npx vitest run server/parser/build-graph.test.ts`
Expected: FAIL — `g.triggerNodes` is `undefined`.

- [ ] **Step 3: Implement**

In `server/parser/build-graph.ts`:

Change the import on line 8 from:
```ts
import { classifyTriggers } from './triggers'
```
to:
```ts
import { classifyTriggers, extractTriggerNodes } from './triggers'
```

After the `nodes` map block ends (line 81, after the closing `})`), add:

```ts
  const triggerNodes = valid.flatMap(wf => extractTriggerNodes(wf, catalog))
```

Change the final return (line 93) from:
```ts
  return { nodes, edges: keptEdges, unresolved, skipped, webhooks, schedules, credentials }
```
to:
```ts
  return { nodes, edges: keptEdges, triggerNodes, unresolved, skipped, webhooks, schedules, credentials }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/tobi/Projekte/n8n-visuzalizer && npx vitest run server/parser/build-graph.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/parser/build-graph.ts server/parser/build-graph.test.ts
git commit -m "feat(parser): emit triggerNodes from buildGraph"
```

---

## Task 4: Frontend — visibility filters trigger nodes

**Files:**
- Modify: `app/composables/useVisibility.ts`
- Test: `app/composables/useVisibility.test.ts` (rewrite)

- [ ] **Step 1: Rewrite the visibility test**

Replace the entire contents of `app/composables/useVisibility.test.ts` with:

```ts
import { describe, it, expect } from 'vitest'
import { defaultVisibility, visibleGraph } from './useVisibility'
import type { WorkflowGraph, WorkflowNode, TriggerNode } from '#shared/types/graph'

const node = (id: string): WorkflowNode => ({
  id, name: id, active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
  summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 },
})

const trig = (id: string, workflowId: string, kind: TriggerNode['kind']): TriggerNode =>
  ({ id, workflowId, kind, label: kind })

const graph: WorkflowGraph = {
  nodes: [node('hook'), node('sub'), node('handler')],
  edges: [
    { source: 'hook', target: 'sub', type: 'execute' },
    { source: 'hook', target: 'handler', type: 'error' },
  ],
  triggerNodes: [trig('t1', 'hook', 'webhook'), trig('t2', 'sub', 'schedule')],
  unresolved: [], skipped: [], webhooks: [], schedules: [], credentials: [],
}

describe('visibleGraph', () => {
  it('shows all workflows, edges and trigger nodes by default', () => {
    const r = visibleGraph(graph, defaultVisibility())
    expect(r.nodes.map(n => n.id).sort()).toEqual(['handler', 'hook', 'sub'])
    expect(r.edges).toHaveLength(2)
    expect(r.triggerNodes.map(t => t.id).sort()).toEqual(['t1', 't2'])
  })

  it('hides trigger nodes of a disabled kind but keeps the workflow', () => {
    const v = defaultVisibility(); v.triggerKinds.webhook = false
    const r = visibleGraph(graph, v)
    expect(r.nodes.map(n => n.id).sort()).toEqual(['handler', 'hook', 'sub'])
    expect(r.triggerNodes.map(t => t.id)).toEqual(['t2'])
  })

  it('drops trigger nodes whose target workflow is hidden', () => {
    const v = defaultVisibility(); v.hideErrorHandlers = true
    const g: WorkflowGraph = { ...graph, triggerNodes: [trig('t3', 'handler', 'webhook')] }
    const r = visibleGraph(g, v)
    expect(r.nodes.map(n => n.id).sort()).toEqual(['hook', 'sub'])
    expect(r.triggerNodes).toHaveLength(0)
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

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/tobi/Projekte/n8n-visuzalizer && npx vitest run app/composables/useVisibility.test.ts`
Expected: FAIL — `visibleGraph` return has no `triggerNodes`; `triggerKinds` typed with `none`.

- [ ] **Step 3: Rewrite `useVisibility.ts`**

Replace the entire contents of `app/composables/useVisibility.ts` with:

```ts
import type { WorkflowGraph, WorkflowNode, TriggerNode, TriggerKind } from '#shared/types/graph'

export interface Visibility {
  triggerKinds: Record<TriggerKind, boolean>
  hideErrorHandlers: boolean
  linkTypes: Record<'execute' | 'webhookHttp' | 'error', boolean>
  overlays: { credentials: boolean; nodeTypes: boolean }
  hiddenNodeTypes: string[]
}

export function defaultVisibility(): Visibility {
  return {
    triggerKinds: { webhook: true, schedule: true, manual: true, app: true, form: true },
    hideErrorHandlers: false,
    linkTypes: { execute: true, webhookHttp: true, error: true },
    overlays: { credentials: false, nodeTypes: false },
    hiddenNodeTypes: [],
  }
}

export function errorHandlerIds(graph: WorkflowGraph): Set<string> {
  const s = new Set<string>()
  for (const e of graph.edges) if (e.type === 'error') s.add(e.target)
  return s
}

export function visibleGraph(graph: WorkflowGraph, v: Visibility): {
  nodes: WorkflowNode[]; edges: WorkflowGraph['edges']; triggerNodes: TriggerNode[]
} {
  const handlers = errorHandlerIds(graph)
  const nodes = graph.nodes.filter(n => {
    if (v.hideErrorHandlers && handlers.has(n.id)) return false
    return true
  })
  const ids = new Set(nodes.map(n => n.id))
  const edges = graph.edges.filter(e =>
    v.linkTypes[e.type as keyof typeof v.linkTypes] && ids.has(e.source) && ids.has(e.target))
  const triggerNodes = graph.triggerNodes.filter(t =>
    v.triggerKinds[t.kind] !== false && ids.has(t.workflowId))
  return { nodes, edges, triggerNodes }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/tobi/Projekte/n8n-visuzalizer && npx vitest run app/composables/useVisibility.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useVisibility.ts app/composables/useVisibility.test.ts
git commit -m "feat(visibility): trigger-kind filter targets trigger nodes"
```

---

## Task 5: Frontend — edge color for triggers

**Files:**
- Modify: `app/composables/edgeColors.ts:1-5`

- [ ] **Step 1: Add the trigger color**

In `app/composables/edgeColors.ts`, change the `EDGE_COLORS` map to:

```ts
export const EDGE_COLORS: Record<string, string> = {
  execute: '#3ddc97',
  webhookHttp: '#10b981',
  error: '#ef4444',
  trigger: '#f5a623',
}
```

- [ ] **Step 2: Commit**

```bash
git add app/composables/edgeColors.ts
git commit -m "feat(edges): trigger edge color"
```

---

## Task 6: Frontend — render trigger nodes in WorkflowMap

**Files:**
- Modify: `app/components/WorkflowMap.vue`

- [ ] **Step 1: Add trigger nodes + derived trigger edges into layout and VueFlow**

In `app/components/WorkflowMap.vue`:

First update the `visible` computed fallback (lines 27-29) so the empty case also carries `triggerNodes`:

```ts
const visible = computed(() => store.graph
  ? visibleGraph(store.graph, store.visibility)
  : { nodes: [], edges: [], triggerNodes: [] })
```

Then replace the `positions` computed (line 31) with one that includes trigger nodes and their derived edges:

```ts
const triggerNodes = computed(() => visible.value.triggerNodes ?? [])
const triggerEdges = computed(() =>
  triggerNodes.value.map(t => ({ source: t.id, target: t.workflowId })))

const positions = computed(() => computeLayeredLayout(
  [...visible.value.nodes, ...triggerNodes.value],
  [...visible.value.edges, ...triggerEdges.value],
))
```

In the `nodes` computed (lines 46-62), after the `base` array and before `overlayNodes`, add a `trigNodes` array, and include it in the return:

```ts
  const trigNodes: Node[] = triggerNodes.value.map(t => ({
    id: t.id, type: 'workflow', position: positions.value.get(t.id) ?? { x: 0, y: 0 },
    data: {
      kind: 'trigger', triggerKind: t.kind, label: t.label, triggers: [],
      inbound: 0, outbound: 0, nodeCount: 0,
      dimmed: focused.value && !flow.value.nodeIds.has(t.workflowId),
      selected: false,
    },
  }))
  return [...base, ...trigNodes, ...overlayNodes]
```

In the `edges` computed (lines 64-78), after `baseEdges` and before `overlayEdges`, add `trigEdges`, and include it in the return:

```ts
  const trigEdges: Edge[] = triggerNodes.value.map(t => ({
    id: `trig-edge:${t.id}`, source: t.id, target: t.workflowId, type: 'flow',
    markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor('trigger') },
    data: { type: 'trigger', dimmed: focused.value && !flow.value.nodeIds.has(t.workflowId), emphasized: false },
  }))
  return [...baseEdges, ...trigEdges, ...overlayEdges]
```

Update `miniColor` (line 23-25) to color trigger nodes:

```ts
function miniColor(node: Node) {
  return node.data?.kind === 'credential' ? '#ffb454'
    : node.data?.kind === 'nodeType' ? '#6aa0ff'
    : node.data?.kind === 'trigger' ? '#f5a623'
    : '#3ddc97'
}
```

In `onNodeClick` (lines 80-83), leave trigger nodes as a no-op — the existing `if/else if` already ignores `kind === 'trigger'`. No change needed.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/tobi/Projekte/n8n-visuzalizer && npx tsc --noEmit`
Expected: No errors in `WorkflowMap.vue`. (Errors may remain in `WorkflowNodeCard.vue` until Task 7.)

- [ ] **Step 3: Commit**

```bash
git add app/components/WorkflowMap.vue
git commit -m "feat(map): render standalone trigger nodes and edges"
```

---

## Task 7: Frontend — trigger node card + remove badge

**Files:**
- Modify: `app/components/WorkflowNodeCard.vue`

- [ ] **Step 1: Add trigger kind, remove the corner badge**

In `app/components/WorkflowNodeCard.vue`:

Change the `Kind` type and props (lines 6-13) to add `trigger` and `triggerKind`:

```ts
type Kind = 'workflow' | 'credential' | 'nodeType' | 'trigger'
const props = defineProps<{
  data: {
    kind: Kind; label: string; triggers: TriggerType[]; triggerKind?: TriggerType
    inbound: number; outbound?: number; nodeCount?: number
    dimmed: boolean; selected?: boolean; emphasized?: boolean
  }
}>()
```

Replace the script computed block (lines 15-27) with:

```ts
const icons: Record<TriggerType, string> = { webhook: '⚡', schedule: '⏰', manual: '▶', app: '🧩', unknown: '•' }
const triggerIcons: Record<string, string> = { webhook: '⚡', schedule: '⏰', manual: '▶', app: '🧩', form: '📝' }
const kindIcon: Record<Kind, string> = { workflow: '🗂', credential: '🔑', nodeType: '◆', trigger: '⚡' }
const accentColor = computed(() =>
  props.data.kind === 'credential' ? 'var(--warn)'
  : props.data.kind === 'nodeType' ? 'var(--link)'
  : props.data.kind === 'trigger' ? '#f5a623'
  : 'var(--accent)')
const headIcon = computed(() =>
  props.data.kind === 'trigger' ? (triggerIcons[props.data.triggerKind ?? ''] ?? '⚡')
  : props.data.kind === 'workflow' ? '🗂'
  : kindIcon[props.data.kind])
```

Replace the template (lines 30-51) with (note: the `.trig` corner badge and the `triggers`/`entryKind` tooltip rows are removed; meta + tooltip render only for `kind === 'workflow'`):

```html
<template>
  <div class="node" :class="[`kind-${data.kind}`, { dimmed: data.dimmed, selected: data.selected, emphasized: data.emphasized }]">
    <Handle type="target" :position="Position.Left" />
    <div class="accent" :style="{ background: accentColor }" />
    <div class="head">
      <span class="ico" aria-hidden="true">{{ headIcon }}</span>
      <span class="label">{{ data.label }}</span>
    </div>
    <div v-if="data.kind === 'workflow'" class="meta">
      <span v-if="data.nodeCount" class="chip">{{ data.nodeCount }} nodes</span>
      <span v-if="data.outbound" class="chip">→ {{ data.outbound }}</span>
      <span v-if="data.inbound" class="chip">← {{ data.inbound }}</span>
    </div>
    <div v-if="data.kind === 'workflow'" class="tip">
      <span v-if="data.nodeCount != null">{{ data.nodeCount }} nodes · ←{{ data.inbound }} →{{ data.outbound ?? 0 }}</span>
    </div>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>
```

Add trigger-node styling to the `<style scoped>` block (after the `.kind-nodeType` rules, around line 70):

```css
.kind-trigger { border-color: #f5a623; min-width: 0; }
.kind-trigger .head { padding: 6px 10px; }
.kind-trigger .label { font-size: 12px; }
```

The now-unused `.trig` CSS rule (old lines 78-79) can be left or removed; remove it for cleanliness.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/tobi/Projekte/n8n-visuzalizer && npx tsc --noEmit`
Expected: PASS — no type errors across the project.

- [ ] **Step 3: Commit**

```bash
git add app/components/WorkflowNodeCard.vue
git commit -m "feat(card): trigger node card kind, remove corner badge"
```

---

## Task 8: Frontend — LayersPanel labels + store persistence

**Files:**
- Modify: `app/components/LayersPanel.vue:5,10-12,27`
- Modify: `app/stores/graph.ts:75`

- [ ] **Step 1: Update LayersPanel trigger filter**

In `app/components/LayersPanel.vue`:

Change the import on line 5 from:
```ts
import type { EntryKind } from '~/composables/useVisibility'
```
to:
```ts
import type { TriggerKind } from '#shared/types/graph'
```

Change the `triggerLabels` map (lines 10-12) to:
```ts
const triggerLabels: Record<TriggerKind, string> = {
  webhook: 'Webhook', schedule: 'Schedule', manual: 'Manual', app: 'App', form: 'Form',
}
```

Change the group heading on line 27 from `Workflows` to `Triggers`:
```html
      <div class="grp">Triggers</div>
```

- [ ] **Step 2: Update store persistence merge**

In `app/stores/graph.ts`, the persistence merge on line 75 already uses a spread:
```ts
            triggerKinds: { ...d.triggerKinds, ...(p.visibility.triggerKinds ?? {}) },
```
This is correct — `d.triggerKinds` (defaults, including `form`) fills any missing keys, and a stale persisted `none` key is harmless. No code change required; verify the line reads as above.

- [ ] **Step 3: Typecheck + full test run**

Run: `cd /Users/tobi/Projekte/n8n-visuzalizer && npx tsc --noEmit && npx vitest run`
Expected: typecheck clean; all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/components/LayersPanel.vue
git commit -m "feat(layers): trigger-kind filter labels"
```

---

## Task 9: Manual verification

- [ ] **Step 1: Run the dev server and inspect the map**

Run: `cd /Users/tobi/Projekte/n8n-visuzalizer && npm run dev`
Load a workflow set (API or upload). Verify:
- Each webhook/schedule/manual/app trigger appears as its own small node to the left of the workflow it fires, connected by an orange `trigger` edge.
- Workflows called only via `executeWorkflow` have NO standalone trigger node and NO bogus "app" badge.
- The corner trigger badge is gone from workflow cards.
- The Layers panel "Triggers" group toggles trigger-node kinds on/off without hiding workflows.

- [ ] **Step 2: Stop the server.**

---

## Self-Review Notes

- **Spec coverage:** data model (Task 1), server extraction + executeWorkflowTrigger fix (Task 2), buildGraph emit (Task 3), visibility semantics (Task 4), edge color (Task 5), layout + map render (Task 6), card + badge removal (Task 7), filter UI + persistence (Task 8). All spec sections covered.
- **`WorkflowNode.triggers` kept** (deviation from spec's "default remove"): `SidePanel.vue:17` still consumes it. The badge is removed only from the graph card, satisfying the "badge removed" decision.
- **Trigger edges derived client-side** from `TriggerNode.workflowId` rather than stored on the graph — DRY; the graph carries only `triggerNodes`.
- **Type consistency:** `TriggerKind` (`webhook|schedule|manual|app|form`) is used identically in types, `extractTriggerNodes`, `useVisibility`, `LayersPanel`. `id` format `trig:${wfId}:${name}#${i}` is identical in the extractor and its tests.
