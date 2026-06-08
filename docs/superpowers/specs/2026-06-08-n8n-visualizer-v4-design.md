# n8n Visualizer v4 — Layered Layout, Unified Layers, Focus & Trace-Flow

**Date:** 2026-06-08
**Status:** Approved (pending spec review)
**Builds on:** v3 (`2026-06-08-n8n-visualizer-v3-design.md`)

## Summary

The Map is hard to read and clicking items elsewhere doesn't reveal data flow.
v4 fixes both:

1. **Layered layout** — replace the force-directed tangle with a top-down dagre
   layout (entry workflows on top, flowing down to sub-workflows and handlers).
2. **Unified Layers panel** — one place to hide/show categories: workflows by
   entry kind, error-handler workflows, edge link-types, and the credential /
   node-type overlays. Replaces today's scattered toggles.
3. **Focus + trace flow** — clicking a workflow (on the Map or via a row in the
   Webhooks/Schedules/Credentials views) highlights its full data-flow path
   (upstream callers + downstream targets), dims the rest, and pans/zooms to fit.

Single-user, local tool. No auth/billing.

## A — Layered layout

Replace `app/composables/useForceLayout.ts` (d3-force) with
`app/composables/useLayeredLayout.ts` using **dagre** (`@dagrejs/dagre`,
synchronous):

- `computeLayeredLayout(nodes, edges, opts?)` → `Map<id, {x, y}>`.
  - Direction top-to-bottom (`rankdir: 'TB'`), sensible `nodesep`/`ranksep`.
  - Node size fixed (e.g. 160×44) for ranking; Vue Flow renders the real card.
  - Cycles are handled by dagre (it breaks them to rank).
- Input is the **visible** node/edge set (see B), so hiding a layer re-ranks.
  dagre is fast and deterministic, so re-running on a visibility change is fine.
- Pure and unit-tested: every input node gets a position; for a simple
  `entry → child` edge the entry's `y` is less than the child's `y` (it ranks
  above). `d3-force` and `@types/d3-force` are removed from deps.

## B — Unified layer / visibility model

Replace the ad-hoc store fields (`layers {credentials,nodeTypes}`, `linkTypes`,
`hiddenNodeTypes`) with one `visibility` object:

```ts
interface Visibility {
  triggerKinds: Record<'webhook' | 'schedule' | 'manual' | 'app' | 'none', boolean> // workflow groups
  hideErrorHandlers: boolean
  linkTypes: Record<'execute' | 'webhookHttp' | 'error', boolean>
  overlays: { credentials: boolean; nodeTypes: boolean }
  hiddenNodeTypes: string[]
}
```

Defaults: all `triggerKinds` true, `hideErrorHandlers` false, all `linkTypes`
true, overlays both false, `hiddenNodeTypes` []. Persisted in `n8nviz.prefs`
(replacing the old keys; a missing/old prefs blob falls back to defaults).

**Pure projection** `visibleGraph(graph, visibility)` → `{ nodes, edges }`:

- A workflow's **entry kind group** = the first present of
  `webhook | schedule | app | manual`, else `none` (sub-workflow). Hidden if its
  group's `triggerKinds` flag is false.
- An **error-handler workflow** = a workflow that is the `target` of any `error`
  edge. When `hideErrorHandlers` is true, these are removed.
- Edges are kept only when their `type`'s `linkTypes` flag is true AND both
  endpoints remain visible.
- Overlay nodes/edges (credentials, node-types minus `hiddenNodeTypes`) are added
  by the existing `overlayNodesAndEdges`, gated by `overlays`.

Unit-tested: hiding a trigger kind drops those workflows + their dangling edges;
`hideErrorHandlers` drops handler nodes + error edges; link-type filter drops
edges; overlay gating.

**UI — `app/components/LayersPanel.vue`** (replaces `MapLayerToggles.vue`):
a compact panel opened from the top bar, grouped **Workflows** (5 entry-kind
checkboxes + "Hide error handlers"), **Edges** (3 link types), **Overlays**
(Credentials, Node types → reveals the existing per-type checklist). Each toggle
writes `store.visibility`. The existing `Toolbar` link-type checkboxes and tag
filter stay; the standalone node-type popover folds into this panel.

## C — Focus + trace flow

**Pure** `traceFlow(nodes, edges, selectedId)` →
`{ nodeIds: Set<string>; edgeIds: Set<string> }`:

- Walk the directed edges **downstream** (selected → targets, transitively) and
  **upstream** (sources → selected, transitively). The union of visited nodes +
  the edges between them is the flow. A `visited` set terminates cycles.
- Returns empty sets when `selectedId` is null or absent.

**Map behavior** (`WorkflowMap.vue` via `useVueFlow`):

- When a node is selected, nodes/edges in the flow render normal; everything else
  gets a `dimmed` class (low opacity). The selected node is accented.
- On select, `fitView({ nodes: [...flow node ids], padding, duration })` pans/
  zooms to the flow. (Use the Vue Flow API available in the installed version;
  if `fitView`-by-nodes isn't supported, fall back to `setCenter` on the selected
  node.)
- Clicking the empty pane (`@pane-click`) clears `selectedId` → full, undimmed
  view.
- Cross-view rows (Webhooks/Schedules/Credentials) already set `selectedId` +
  `view='map'`; landing on the Map triggers the same focus.

Unit-tested: `traceFlow` returns selected + upstream + downstream for a chain,
excludes unrelated nodes, and terminates on a cycle.

## Architecture & Boundaries

- Three pure units — `computeLayeredLayout`, `visibleGraph`, `traceFlow` — each
  testable in isolation; `WorkflowMap.vue` composes them: `visibleGraph` →
  `computeLayeredLayout` → render → `traceFlow` highlight/dim/fit.
- `overlayNodesAndEdges` is reused (called inside `visibleGraph`), gaining the
  `hiddenNodeTypes` it already supports.
- Store: `visibility` replaces `layers`/`linkTypes`/`hiddenNodeTypes`; a small
  migration in the prefs-hydration tolerates old/missing blobs. `selectedId`,
  `view`, persistence, and connection logic are unchanged.
- `LayersPanel.vue` replaces `MapLayerToggles.vue` + `NodeTypeLayerPanel.vue`
  (the latter's checklist becomes the Overlays→Node-types subsection).
- Dependency: add `@dagrejs/dagre`; remove `d3-force`, `@types/d3-force`.

## Error Handling

- A graph with cycles lays out (dagre breaks cycles); no crash.
- Empty / null graph → empty layout, empty flow, full undimmed view.
- Old persisted prefs (v3 shape) → ignored field-by-field, defaults used; no crash.
- A `selectedId` not in the visible set (e.g. its layer was hidden) → no flow
  highlight; the node simply isn't shown. The side panel still resolves it from
  the full graph as today.

## Testing

- **Layout** — `computeLayeredLayout`: all nodes placed; entry ranks above target.
- **Visibility** — `visibleGraph`: trigger-kind hiding, error-handler hiding,
  link-type filtering, endpoint-pruned dangling edges, overlay gating.
- **Flow** — `traceFlow`: chain upstream+downstream, unrelated excluded, cycle
  terminates, null/absent selection → empty.
- **Components** — light: `LayersPanel` writes the right `visibility` fields
  (toggle a checkbox → store updates). Map composition verified via build + the
  existing data-path e2e; pan/zoom/dim is manual browser verification.

## Build Phasing

One spec, in order; each step leaves the app green:

- **P1 — Layered layout:** add dagre, `useLayeredLayout`, swap it into the Map,
  remove d3-force. (Map immediately reads better.)
- **P2 — Visibility model + Layers panel:** `visibleGraph`, store `visibility`
  migration, `LayersPanel`, wire Map to render the visible+laid-out set.
- **P3 — Focus + trace flow:** `traceFlow`, Map highlight/dim/fit, pane-click
  reset; confirm cross-view rows land focused.

## Out of Scope / Future

- Manual node dragging persistence, saved layouts, minimap density controls.
- Light mode, auth, SaaS — unchanged direction.
