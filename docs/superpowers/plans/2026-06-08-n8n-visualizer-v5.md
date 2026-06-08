# n8n Visualizer v5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Map modern, dynamic, and interactive — rich node cards, animated flow edges, a labeled control bar + minimap, dotted background, hover highlight / tooltips / draggable nodes / animated transitions — and restyle the off-theme Toolbar / tag filter / connect box.

**Architecture:** Visual + interaction only; no data-model change. One pure unit (`neighbors`) for hover highlight; new presentational components (`FlowEdge`, `MapControls`, restyled node card) wired into `WorkflowMap.vue`. The v4 pipeline (visibleGraph → layered layout → traceFlow focus) is untouched underneath.

**Tech Stack:** Bun, Nuxt 4, Vue Flow (+ `@vue-flow/minimap`, `@vue-flow/background`, `@vue-flow/controls`→removed), Pinia, Vitest.

## Conventions (from v1–v4)
- Nuxt 4 srcDir `app/`. `~`=`app/`. Components auto-import by BARE name. Tokens in `app/assets/tokens.css` (`--bg-0..3`, `--accent`, `--warn`, `--danger`, `--link`, `--text*`, `--radius-*`, `--shadow-*`, `--dur`, `--ease`).
- Tests beside source; `bun run test -- <path>` / `bun run test`. Build `bun run build`. Dev `bun run dev`.
- Components with unit tests `import { computed, ref } from 'vue'` explicitly.
- All existing 101 tests stay green. `WorkflowNodeCard.spec.ts` asserts label text, `[data-trigger="webhook"]`, `.kind-credential`, `.dimmed`, `.selected` — preserve these hooks.

## File Structure
```
package.json                          # MODIFY: + @vue-flow/minimap
app/composables/useNeighbors.ts       # NEW: neighbors(edges, id)
app/components/WorkflowNodeCard.vue    # MODIFY: rich card + tooltip + accent
app/components/FlowEdge.vue            # NEW: animated bezier edge (type 'flow')
app/components/MapControls.vue         # NEW: labeled control bar
app/components/WorkflowMap.vue         # MODIFY: edge type, controls, minimap, bg dots, hover, transitions
app/components/Toolbar.vue            # MODIFY: Control-Room restyle + connect pill + tag chips
app/assets/tokens.css                 # MODIFY: add the Vue Flow node-transition + accent-map helpers
```

---

# PHASE 1 — Static restyle

## Task 1: Rich node cards (+ extend Map node data)

**Files:** modify `app/components/WorkflowNodeCard.vue`, `app/components/WorkflowMap.vue`. Build-verified; keep `WorkflowNodeCard.spec.ts` green.

- [ ] **Step 1: Pass richer data from the Map**

In `app/components/WorkflowMap.vue`, the base `nodes` computed `data` object: add `nodeCount`, `outbound`, and an `entryKind`. Replace the base node `data` block with:
```ts
    data: {
      kind: 'workflow', label: n.name, triggers: n.triggers,
      inbound: n.summary.inbound, outbound: n.summary.outbound, nodeCount: n.summary.nodeCount,
      dimmed: !matchesTags(n, store.tagFilter) || (focused.value && !flow.value.nodeIds.has(n.id)),
      selected: store.selectedId === n.id,
    },
```
(Overlay node `data` stays as-is but add `outbound: 0, nodeCount: 0` for shape consistency.)

- [ ] **Step 2: Restyle the node card**

Replace `app/components/WorkflowNodeCard.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import type { TriggerType } from '#shared/types/graph'

type Kind = 'workflow' | 'credential' | 'nodeType'
const props = defineProps<{
  data: {
    kind: Kind; label: string; triggers: TriggerType[]
    inbound: number; outbound?: number; nodeCount?: number
    dimmed: boolean; selected?: boolean; emphasized?: boolean
  }
}>()

const icons: Record<TriggerType, string> = { webhook: '⚡', schedule: '⏰', manual: '▶', app: '🧩', unknown: '•' }
const kindIcon: Record<Kind, string> = { workflow: '🗂', credential: '🔑', nodeType: '◆' }
const accent: Record<string, string> = {
  webhook: 'var(--accent)', schedule: 'var(--link)', app: '#b794f6', manual: 'var(--text-dim)', none: 'var(--text-faint)',
}
const PRIORITY: TriggerType[] = ['webhook', 'schedule', 'app', 'manual']
const entryKind = computed(() => PRIORITY.find(k => props.data.triggers.includes(k)) ?? 'none')
const accentColor = computed(() =>
  props.data.kind === 'credential' ? 'var(--warn)'
  : props.data.kind === 'nodeType' ? 'var(--link)'
  : accent[entryKind.value])
const headIcon = computed(() =>
  props.data.kind === 'workflow'
    ? (icons[entryKind.value as TriggerType] ?? '🗂')
    : kindIcon[props.data.kind])
</script>

<template>
  <div class="node" :class="[`kind-${data.kind}`, { dimmed: data.dimmed, selected: data.selected, emphasized: data.emphasized }]">
    <Handle type="target" :position="Position.Left" />
    <div class="accent" :style="{ background: accentColor }" />
    <div class="head">
      <span class="ico" :data-trigger="entryKind">{{ headIcon }}</span>
      <span class="label">{{ data.label }}</span>
    </div>
    <div v-if="data.kind === 'workflow'" class="meta">
      <span v-if="data.nodeCount" class="chip">{{ data.nodeCount }} nodes</span>
      <span v-if="data.outbound" class="chip">→ {{ data.outbound }}</span>
      <span v-if="data.inbound" class="chip">← {{ data.inbound }}</span>
    </div>
    <div class="tip">
      <span v-for="t in data.triggers" :key="t" :data-trigger="t">{{ icons[t] }} {{ t }}</span>
      <span v-if="data.nodeCount != null">{{ data.nodeCount }} nodes · ←{{ data.inbound }} →{{ data.outbound ?? 0 }}</span>
    </div>
    <Handle type="source" :position="Position.Right" />
  </div>
</template>

<style scoped>
.node { position: relative; min-width: 150px; max-width: 230px; padding: 0; overflow: visible;
  border: 1px solid var(--border); border-radius: var(--radius-m); background: var(--bg-2); color: var(--text);
  box-shadow: var(--shadow-1); transition: box-shadow var(--dur) var(--ease), opacity var(--dur) var(--ease), transform var(--dur) var(--ease); }
.node:hover { transform: translateY(-1px); box-shadow: var(--shadow-glow); }
.node.emphasized { box-shadow: var(--shadow-glow); }
.node.selected { border-color: var(--accent); box-shadow: var(--shadow-glow); }
.node.dimmed { opacity: 0.22; }
.accent { height: 4px; border-radius: var(--radius-m) var(--radius-m) 0 0; }
.head { display: flex; align-items: center; gap: 7px; padding: 8px 10px 4px; }
.ico { font-size: 13px; }
.label { font-weight: 600; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta { display: flex; gap: 5px; padding: 0 10px 8px; }
.chip { background: var(--bg-3); color: var(--text-dim); font-size: 10.5px; border-radius: 5px; padding: 1px 6px; }
.kind-credential { border-color: var(--warn); }
.kind-credential .accent { display: none; }
.kind-nodeType { border-style: dashed; border-color: var(--link); }
.kind-nodeType .accent { display: none; }
.kind-credential .head, .kind-nodeType .head { padding: 8px 12px; }
/* hover tooltip */
.tip { position: absolute; left: 50%; bottom: calc(100% + 8px); transform: translateX(-50%);
  display: none; flex-direction: column; gap: 2px; white-space: nowrap;
  background: var(--bg-0); border: 1px solid var(--border); border-radius: var(--radius-s); box-shadow: var(--shadow-1);
  padding: 6px 8px; font-size: 11px; color: var(--text-dim); z-index: 50; pointer-events: none; }
.node:hover .tip { display: flex; }
</style>
```

- [ ] **Step 3: Keep the card spec green**

Run: `bun run test -- app/components/WorkflowNodeCard.spec.ts`
Expected: PASS. The spec mounts with `data: { kind, label, triggers, inbound, dimmed }` and asserts the label text, `[data-trigger="webhook"]` exists, `.kind-credential` exists, and `.dimmed`/`.selected` classes. All those hooks are preserved (the `[data-trigger]` now appears on the head icon and tooltip; `.kind-credential` on the root). If an assertion breaks because a hook moved, adjust the COMPONENT to keep the hook (not the test), or update the test only if the hook's location legitimately changed — report which.

- [ ] **Step 4: Build + full suite**

Run: `bun run build` (clean) then `bun run test` (all pass; report count).

- [ ] **Step 5: Commit**

```bash
git add app/components/WorkflowNodeCard.vue app/components/WorkflowMap.vue
git commit -m "feat: rich workflow node cards with accent, meta chips, hover tooltip"
```

---

## Task 2: Dotted background + Toolbar/tags/connect restyle

**Files:** modify `app/components/WorkflowMap.vue`, `app/components/Toolbar.vue`. Build-verified.

- [ ] **Step 1: Dotted Control-Room background**

In `app/components/WorkflowMap.vue`:
1. Change the background import to include the variant: `import { Background, BackgroundVariant } from '@vue-flow/background'`
2. Replace `<Background />` in the template with:
```vue
    <Background :variant="BackgroundVariant.Dots" :gap="22" :size="1.2" pattern-color="#1c2640" />
```

- [ ] **Step 2: Restyle the Toolbar (tokenize + connect pill + tag chips)**

First READ `app/components/Toolbar.vue`. Replace its `<style scoped>` block entirely with token-based styling, and adjust the connected state to a pill. Specifically:
1. Replace the `<style scoped>` block with:
```css
.toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
details { position: relative; }
summary { list-style: none; cursor: pointer; display: inline-flex; align-items: center; gap: 7px;
  background: var(--bg-2); border: 1px solid var(--border); color: var(--text); border-radius: var(--radius-m); padding: 7px 11px; font-size: 12px; }
summary::-webkit-details-marker { display: none; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; position: relative; margin-top: 8px; }
input { background: var(--bg-2); border: 1px solid var(--border); color: var(--text); border-radius: var(--radius-m); padding: 7px 10px; font-size: 12px; }
input::placeholder { color: var(--text-faint); }
button { background: var(--accent-dim); color: var(--accent); border: 1px solid transparent; border-radius: var(--radius-m); padding: 7px 12px; font-size: 12px; cursor: pointer; }
button:hover { filter: brightness(1.15); }
.disconnect { background: var(--bg-3); color: var(--text); border: 1px solid var(--border); }
.hint { color: var(--text-faint); font-size: 11px; }
.search { position: relative; }
.search input { width: 280px; }
.search .results { position: absolute; top: 100%; left: 0; margin-top: 4px; background: var(--bg-2); border: 1px solid var(--border);
  border-radius: var(--radius-m); list-style: none; padding: 4px; width: 320px; z-index: 40; box-shadow: var(--shadow-1); }
.search .results li { padding: 5px 8px; cursor: pointer; border-radius: var(--radius-s); color: var(--text); }
.search .results li:hover { background: var(--bg-3); }
.kind { font-size: 11px; color: var(--text-faint); margin-right: 6px; }
.tags { display: flex; gap: 6px; flex-wrap: wrap; }
.tags button { background: var(--bg-3); color: var(--text-dim); border: 1px solid var(--border); border-radius: 999px; padding: 3px 10px; }
.tags button.active { background: var(--accent-dim); color: var(--accent); border-color: transparent; }
.err { color: var(--danger); font-size: 12px; }
.unresolved button { background: var(--bg-3); color: var(--text-dim); border: 1px solid var(--border); }
</style>
```
2. In the template, ensure the connected summary reads as a pill with the host and a disconnect affordance — the v3 markup already shows `Connected to {host}` in the `<summary>` when `store.connectedHost`; keep that. Add `class="search"` to the search `.row` wrapper and `class="tags"` to the tags row wrapper and `class="unresolved"` to the unresolved row wrapper if not already present, so the new styles target them. Do NOT change the script logic.

(Net effect: dark surfaces, accent primary button, pill-shaped active tag chips, dark search dropdown — matching the rest of the app. The exact class names above must match the wrappers in the template; rename wrappers minimally if needed.)

- [ ] **Step 3: Build + full suite**

Run: `bun run build` (clean) then `bun run test` (all pass; report count).

- [ ] **Step 4: Commit**

```bash
git add app/components/WorkflowMap.vue app/components/Toolbar.vue
git commit -m "feat: dotted Control-Room canvas + tokenized toolbar, connect pill, tag chips"
```

---

# PHASE 2 — Edges, controls, minimap

## Task 3: Animated flow edge

**Files:** create `app/components/FlowEdge.vue`; modify `app/components/WorkflowMap.vue`. Build-verified.

- [ ] **Step 1: Create the edge component**

Create `app/components/FlowEdge.vue`:
```vue
<script setup lang="ts">
import { computed } from 'vue'
import { BaseEdge, getBezierPath, type EdgeProps } from '@vue-flow/core'

const props = defineProps<EdgeProps>()

const colors: Record<string, string> = { execute: '#3ddc97', webhookHttp: '#10b981', error: '#ef4444' }
const path = computed(() => getBezierPath(props))
const color = computed(() => colors[(props.data as any)?.type] ?? '#6aa0ff')
const dimmed = computed(() => !!(props.data as any)?.dimmed)
const emphasized = computed(() => !!(props.data as any)?.emphasized)
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path[0]"
    :marker-end="markerEnd"
    :class="['flowedge', { dimmed, emphasized }]"
    :style="{ stroke: color, strokeWidth: emphasized ? 3 : 2, opacity: dimmed ? 0.12 : 1 }"
  />
</template>

<style scoped>
@keyframes flowdash { to { stroke-dashoffset: -16; } }
.flowedge :deep(path) { stroke-dasharray: 4 6; animation: flowdash 0.7s linear infinite; }
.flowedge.dimmed :deep(path) { animation: none; }
@media (prefers-reduced-motion: reduce) { .flowedge :deep(path) { animation: none; } }
</style>
```
Note: `getBezierPath(props)` returns `[path, labelX, labelY, ...]`; `path[0]` is the SVG path. If the installed Vue Flow's `getBezierPath` signature differs (e.g. requires a destructured object), adapt to pass `{ sourceX: props.sourceX, sourceY: props.sourceY, sourcePosition: props.sourcePosition, targetX: props.targetX, targetY: props.targetY, targetPosition: props.targetPosition }` — same output. Report what you used.

- [ ] **Step 2: Use the edge type in the Map**

In `app/components/WorkflowMap.vue`:
1. Add to imports: `import { MarkerType } from '@vue-flow/core'`
2. In the `edges` computed, change the base edge mapping to use the `flow` type + data (drop the inline stroke/opacity since FlowEdge owns styling):
```ts
  const baseEdges: Edge[] = visible.value.edges.map(e => {
    const inFlow = !focused.value || flow.value.edgeIds.has(`${e.source}|${e.target}`)
    return {
      id: `${e.source}|${e.target}|${e.type}`, source: e.source, target: e.target, type: 'flow',
      markerEnd: MarkerType.ArrowClosed,
      data: { type: e.type, dimmed: !inFlow, emphasized: false },
    }
  })
```
   (Overlay edges stay as plain edges with their existing inline style.)
3. In the template, register the custom edge slot inside `<VueFlow>` (next to the node slot):
```vue
    <template #edge-flow="props">
      <FlowEdge v-bind="props" />
    </template>
```
4. The `edgeStyle` const is now only used by overlay edges? No — overlay edges have their own inline style. Remove the now-unused `edgeStyle` const if nothing references it (the base edges no longer do); if the build flags it as unused, delete it.

- [ ] **Step 3: Build + full suite**

Run: `bun run build` (clean) then `bun run test` (all pass; report count). If the build can't resolve `getBezierPath`/`BaseEdge`/`MarkerType` from `@vue-flow/core`, confirm the exports in the installed version and adapt imports (same behavior); report.

- [ ] **Step 4: Commit**

```bash
git add app/components/FlowEdge.vue app/components/WorkflowMap.vue
git commit -m "feat: animated directional flow edges with arrowheads"
```

---

## Task 4: Labeled control bar + minimap (replace default Controls)

**Files:** add dep; create `app/components/MapControls.vue`; modify `app/components/WorkflowMap.vue`. Build-verified.

- [ ] **Step 1: Add the minimap package**

Run: `bun add @vue-flow/minimap`

- [ ] **Step 2: Create the control bar**

Create `app/components/MapControls.vue`:
```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useVueFlow } from '@vue-flow/core'

const props = defineProps<{ flowId: string; minimap: boolean }>()
const emit = defineEmits<{ 'update:minimap': [boolean] }>()

const { zoomIn, zoomOut, fitView, nodesDraggable, elementsSelectable } = useVueFlow(props.flowId)
const locked = ref(false)
function toggleLock() {
  locked.value = !locked.value
  nodesDraggable.value = !locked.value
  elementsSelectable.value = !locked.value
}
</script>

<template>
  <div class="ctrl">
    <button @click="zoomIn()"><span class="i">＋</span><span class="t">Zoom in</span></button>
    <button @click="zoomOut()"><span class="i">－</span><span class="t">Zoom out</span></button>
    <button @click="fitView({ padding: 0.2, duration: 300 })"><span class="i">⤢</span><span class="t">Fit view</span></button>
    <button :class="{ on: locked }" @click="toggleLock"><span class="i">{{ locked ? '🔒' : '🔓' }}</span><span class="t">{{ locked ? 'Locked' : 'Lock' }}</span></button>
    <button :class="{ on: minimap }" @click="emit('update:minimap', !minimap)"><span class="i">🗺</span><span class="t">Minimap</span></button>
  </div>
</template>

<style scoped>
.ctrl { position: absolute; left: 14px; bottom: 14px; z-index: 10; display: flex; flex-direction: column; gap: 4px;
  background: color-mix(in srgb, var(--bg-1) 92%, transparent); border: 1px solid var(--border);
  border-radius: var(--radius-m); padding: 6px; box-shadow: var(--shadow-1); backdrop-filter: blur(6px); }
button { display: flex; align-items: center; gap: 8px; background: transparent; border: none; color: var(--text-dim);
  font-size: 12px; padding: 6px 10px; border-radius: var(--radius-s); cursor: pointer; transition: all var(--dur) var(--ease); }
button:hover { background: var(--bg-3); color: var(--text); }
button.on { color: var(--accent); }
.i { width: 16px; text-align: center; }
</style>
```
(If `color-mix` is unsupported in the target browser, replace the `.ctrl` background with `var(--bg-1)`.)

- [ ] **Step 3: Wire controls + minimap into the Map, remove default Controls**

In `app/components/WorkflowMap.vue`:
1. Imports: remove `import { Controls } from '@vue-flow/controls'`; add:
```ts
import { MiniMap } from '@vue-flow/minimap'
import '@vue-flow/minimap/dist/style.css'
import { ref } from 'vue'
```
(merge `ref` into the existing `vue` import.)
2. Add a minimap visibility ref: `const showMinimap = ref(true)`
3. Add a minimap node-color helper:
```ts
function miniColor(node: Node) {
  return node.data?.kind === 'credential' ? '#ffb454' : node.data?.kind === 'nodeType' ? '#6aa0ff' : '#3ddc97'
}
```
4. In the template, replace `<Controls />` with:
```vue
    <MiniMap v-if="showMinimap" pannable zoomable :node-color="miniColor"
             mask-color="rgba(11,15,26,0.7)" />
    <MapControls :flow-id="FLOW_ID" v-model:minimap="showMinimap" />
```

- [ ] **Step 4: Build + full suite**

Run: `bun run build` (clean) then `bun run test` (all pass; report count). The MiniMap dark styling: if `mask-color`/`node-color` props differ in the installed `@vue-flow/minimap`, adapt to the supported props (same intent) and report.

- [ ] **Step 5: Commit**

```bash
git add app/components/MapControls.vue app/components/WorkflowMap.vue package.json bun.lock
git commit -m "feat: labeled control bar (zoom/fit/lock/minimap) + dark minimap, drop default controls"
```

---

# PHASE 3 — Interactivity

## Task 5: Hover highlight (neighbors) + tooltip + transitions

**Files:** create `app/composables/useNeighbors.ts` + test; modify `app/components/WorkflowMap.vue`, `app/assets/tokens.css`. TDD for the composable; rest build-verified.

- [ ] **Step 1: Write the failing neighbors test**

Create `app/composables/useNeighbors.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { neighbors } from './useNeighbors'

const edges = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },   // c is 2 hops from a
  { source: 'd', target: 'a' },
]

describe('neighbors', () => {
  it('returns the node + its 1-hop neighbors both directions', () => {
    const r = neighbors(edges, 'a')
    expect([...r.nodeIds].sort()).toEqual(['a', 'b', 'd'])   // not c
  })
  it('returns the connecting edge ids', () => {
    const r = neighbors(edges, 'a')
    expect(r.edgeIds.has('a|b')).toBe(true)
    expect(r.edgeIds.has('d|a')).toBe(true)
    expect(r.edgeIds.has('b|c')).toBe(false)
  })
  it('returns empty for null/absent', () => {
    expect(neighbors(edges, null).nodeIds.size).toBe(0)
  })
})
```

- [ ] **Step 2: Run it red**

Run: `bun run test -- app/composables/useNeighbors.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `app/composables/useNeighbors.ts`:
```ts
interface NEdge { source: string; target: string }

export function neighbors(edges: NEdge[], id: string | null): { nodeIds: Set<string>; edgeIds: Set<string> } {
  const nodeIds = new Set<string>()
  const edgeIds = new Set<string>()
  if (!id) return { nodeIds, edgeIds }
  nodeIds.add(id)
  for (const e of edges) {
    if (e.source === id) { nodeIds.add(e.target); edgeIds.add(`${e.source}|${e.target}`) }
    if (e.target === id) { nodeIds.add(e.source); edgeIds.add(`${e.source}|${e.target}`) }
  }
  return { nodeIds, edgeIds }
}
```

- [ ] **Step 4: Run it green**

Run: `bun run test -- app/composables/useNeighbors.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire hover highlight + emphasis into the Map**

In `app/components/WorkflowMap.vue`:
1. Add import: `import { neighbors } from '~/composables/useNeighbors'`
2. Add a hovered ref + computed: `const hoveredId = ref<string | null>(null)` and
```ts
const hover = computed(() => neighbors(visible.value.edges, focused.value ? null : hoveredId.value))
const hovering = computed(() => !focused.value && hoveredId.value != null && hover.value.nodeIds.size > 0)
```
3. In the base node `data`, add an `emphasized` flag:
```ts
      emphasized: hovering.value && hover.value.nodeIds.has(n.id),
```
4. In the base edge `data`, set `emphasized: hovering.value && hover.value.edgeIds.has(`${e.source}|${e.target}`)` (replacing the `emphasized: false`).
5. Add handlers:
```ts
function onNodeEnter({ node }: { node: Node }) { if (node.data?.kind === 'workflow') hoveredId.value = node.id }
function onNodeLeave() { hoveredId.value = null }
```
6. In the template `<VueFlow ...>` add `@node-mouse-enter="onNodeEnter" @node-mouse-leave="onNodeLeave"`.

- [ ] **Step 6: Animated node transitions**

Append to `app/assets/tokens.css` (global, so it reaches Vue Flow's node wrappers):
```css
.vue-flow__node { transition: transform var(--dur) var(--ease); }
.vue-flow__node.dragging { transition: none; }
```
(Excluding `.dragging` keeps drags responsive while filter/layout moves glide.)

- [ ] **Step 7: Build + full suite**

Run: `bun run build` (clean) then `bun run test` (all pass; report count).

- [ ] **Step 8: Commit**

```bash
git add app/composables/useNeighbors.ts app/composables/useNeighbors.test.ts app/components/WorkflowMap.vue app/assets/tokens.css
git commit -m "feat: hover highlight, node tooltip, animated node transitions"
```

---

## Task 6: Final verification

**Files:** none.

- [ ] **Step 1: Full suite** — `bun run test` → all pass; report count.
- [ ] **Step 2: Build** — `bun run build` → clean.
- [ ] **Step 3: Data-path e2e** (proves the visual changes didn't break ingest/render path):
```bash
TMPDIR=/tmp bun run dev > /tmp/v5-e2e.log 2>&1 &
DEV=$!
for i in $(seq 1 40); do curl -s http://localhost:3000/ >/dev/null 2>&1 && break; sleep 1; done
echo "index=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/)"
kill $DEV 2>/dev/null
```
Expected: `index=200`. State clearly that the visual/interaction results (rich cards, animated edges, control bar, minimap, hover highlight, tooltips, dragging, transitions, restyled toolbar) are **manual browser checks** — load via API or upload JSON and inspect.
- [ ] **Step 4:** No commit (verification only).

---

## Self-Review Notes
- **Spec coverage:** rich nodes — T1; dotted bg + toolbar/tags/connect restyle — T2; animated flow edges — T3; labeled control bar + minimap, default Controls removed — T4; hover highlight (`neighbors`) + tooltip + draggable/lock (lock via T4 control) + animated transitions — T5. All spec sections mapped.
- **Type consistency:** node `data` gains `outbound?`/`nodeCount?`/`emphasized?` (T1/T5) — all optional, so `WorkflowNodeCard.spec`'s minimal `data` still type-checks at runtime. `FlowEdge` reads `data.{type,dimmed,emphasized}` set by the Map (T3); `MapControls` uses `useVueFlow(FLOW_ID)` matching the Map's id. `neighbors` edge-id convention `source|target` matches the Map's edge data keys and `traceFlow`.
- **Regression guard:** `WorkflowNodeCard.spec` hooks (`label`, `[data-trigger="webhook"]`, `.kind-credential`, `.dimmed`, `.selected`) preserved in the restyle (T1 Step 3 calls this out). Removing `<Controls>`/`edgeStyle` only after their replacements land (T3/T4). `getBezierPath`/minimap prop adaptations are explicit fallbacks, not vague steps.
- **Placeholder scan:** none. Visual outcomes flagged as manual checks (T6), not skipped assertions.
