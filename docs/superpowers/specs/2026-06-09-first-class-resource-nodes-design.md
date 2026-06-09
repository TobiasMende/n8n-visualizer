# First-Class Credential & Data-Table Graph Nodes — Design

**Date:** 2026-06-09
**Status:** Approved (pending spec review)

## Goal

Promote credentials and data tables from optional **radial overlay satellites** to
**first-class nodes in the map's layered layout** — ranked by dagre, edge-routed, selectable,
and dimmed on focus — exactly like trigger nodes already are. Node-types stay an overlay.

## Background — the trigger precedent

The map already has a model for "entities that aren't workflows but belong in the graph":
`triggerNodes`. They are not part of `WorkflowGraph.nodes`; they are a separate array that
`WorkflowMap.vue` promotes into the layout:

- fed into `computeLayeredLayout` alongside workflow nodes + edges, so dagre positions them;
- rendered through `WorkflowNodeCard` with `kind: 'trigger'`;
- connected by real edges (`trigger → workflow`) drawn with `FlowEdge`;
- filtered by `visibility.triggerKinds`;
- dimmed when a workflow is focused and the trigger's workflow isn't in the traced flow.

Credentials and data tables currently use a different, weaker model: `overlayNodesAndEdges`
computes them with **radial placement** around their workflow, dashed edges, gated behind
`visibility.overlays.{credentials,dataTables}` (both default off). This makes them look
secondary. The change: make them follow the trigger pattern instead.

## Decisions (confirmed)

- **Default visibility:** data tables **on** by default, credentials **off** by default. Both
  toggleable.
- **Node identity:** one shared node per credential/table, with one edge per using-workflow
  (shows shared-resource coupling). Matches the current dedup.
- **Node-types:** unchanged — stays a radial overlay (`overlayNodesAndEdges`).
- **Edge direction:** `workflow → resource`, so resources rank **below** workflows in the
  TB layout (triggers stay above).
- **Focus dimming:** resources dim on workflow-focus like triggers.

## Architecture

Client-side promotion, mirroring triggers. The server graph model is unchanged: credentials
and data tables remain `CredentialRef[]` / `DataTableRef[]` (the list views consume them
directly). Rejected alternative — baking credential/table nodes into
`WorkflowGraph.nodes/edges` server-side — adds blast radius for no gain the trigger
precedent doesn't already cover. YAGNI.

### New unit — `app/composables/useResourceNodes.ts` (pure, tested)

```ts
export interface ResourceNode {
  id: string
  kind: 'credential' | 'dataTable'
  label: string
  workflowIds: string[]   // only the in-scope workflows that use it
}
export interface ResourceEdge {
  source: string          // workflow id
  target: string          // resource id
  kind: 'credential' | 'dataTable'
}

export function resourceNodes(
  graph: WorkflowGraph | null,
  show: { credentials: boolean; dataTables: boolean },
  keep: Set<string>,      // workflow ids surviving visibility + tag-scope
): { nodes: ResourceNode[]; edges: ResourceEdge[] }
```

Behaviour:
- Credentials only when `show.credentials`; data tables only when `show.dataTables`.
- Resource id formats reuse the existing selection ids so the side panels keep working:
  credential → `` `cred:${c.type}:${c.id ?? c.name}` `` (matches `store.selectedCredential`),
  data table → `` `datatable:${t.id}` `` (matches `store.selectedDataTable`).
- For each resource, keep only `workflowIds` that are in `keep`; if none remain, drop the
  resource entirely (mirrors trigger scope-filtering). One shared node, one
  `workflow → resource` edge per surviving workflow.

### `WorkflowMap.vue` changes

Add, parallel to the existing `triggerNodes` / `triggerEdges` / layout wiring:

- `const resources = computed(() => resourceNodes(store.graph, store.visibility.resources, keepSet))`
  where `keepSet` is the scoped workflow id set (the same `keep` used for triggers — extract
  it from the `scoped` computed so both share it).
- Feed `resources.nodes` and `resources.edges` into `computeLayeredLayout`'s inputs, after
  workflows + triggers:
  `computeLayeredLayout([...wf, ...triggers, ...resources.nodes], [...wfEdges, ...trigEdges, ...resources.edges])`.
- Render resource nodes (`type: 'workflow'`, `data.kind` = `'credential'`/`'dataTable'`) at
  their dagre positions, with `selected` bound to `store.selectedCredId` /
  `store.selectedDataTableId`, and `dimmed` = `focused && none of workflowIds in flow.nodeIds`.
- Render resource edges through `FlowEdge` (`type: 'flow'`, `data.type` =
  `'credential'`/`'dataTable'`, `markerEnd` colored via `edgeColor`), `dimmed` =
  `focused && !flow.nodeIds.has(thatWorkflowId)` — same rule as trigger edges. Solid, not
  dashed (they're first-class now).
- `onNodeClick` already routes `credential` / `dataTable` kinds to the right selection — keep.
- `overlay` (node-types) is computed as today; resource positions are already in the
  `positions` map, which is harmless to the radial node-type placement.

### Visibility model — `app/composables/useVisibility.ts`

Move credentials + data tables out of `overlays` into a first-class `resources` group:

```ts
export interface Visibility {
  triggerKinds: Record<TriggerKind, boolean>
  hideErrorHandlers: boolean
  linkTypes: Record<'execute' | 'webhookHttp' | 'error', boolean>
  resources: { credentials: boolean; dataTables: boolean }   // NEW
  overlays: { nodeTypes: boolean }                            // was { credentials, nodeTypes, dataTables }
  hiddenNodeTypes: string[]
}

// defaults
resources: { credentials: false, dataTables: true },
overlays: { nodeTypes: false },
```

`app/stores/graph.ts` prefs-merge: add a `resources` merge line next to the existing
`overlays` spread (`resources: { ...d.resources, ...(p.visibility.resources ?? {}) }`). Old
persisted `overlays.credentials/dataTables` keys are simply ignored — a one-time reset where
data tables appear by default and credentials are hidden. Acceptable.

### `app/composables/useMapLayers.ts`

Strip the `credentials` and `dataTables` branches; `overlayNodesAndEdges` now handles only
node-types. Signature narrows: `layers: { nodeTypes: boolean }`, and `OverlayNode.kind`
narrows to `'nodeType'`. Update `WorkflowMap`'s `overlayEdges` styling to the node-types
case only (blue dashed `contains`).

### `app/composables/edgeColors.ts`

Add `credential: '#ffb454'` to `EDGE_COLORS` (`dataTable: '#b48cff'` already exists) so
resource edges + arrowheads are colored.

### `app/components/LayersPanel.vue`

Add a **Resources** group (above Overlays) with two checkboxes bound to
`store.visibility.resources.dataTables` and `.credentials`. The Overlays group keeps only
"Node types".

## What does NOT change

- `WorkflowNodeCard.vue` — `credential` / `dataTable` kinds already styled.
- `miniColor` in `WorkflowMap` — already maps both kinds.
- Side panels (`CredentialPanel`, `DataTablePanel`), list views, the server parser/merge,
  and the `WorkflowGraph` type.

## Error handling / edge cases

- Resource with all using-workflows filtered out (tag scope / hidden error handlers) → the
  resource is dropped, not orphaned.
- A workflow focused for tracing: resource nodes/edges dim unless one of their workflows is
  in the traced flow — never break the trace set (resources aren't in `scoped.nodes`, so
  `traceFlow` and `tagScopedNodeIds` are unaffected).
- Both resource toggles off → no resource nodes; graph identical to today's overlay-off map.

## Testing

- **`app/composables/useResourceNodes.test.ts` (new):** credential shown only when flag on;
  data-table shown only when flag on; shared node yields N edges; resources with no in-scope
  workflow are dropped; resource ids match the panel-selection id formats; both-off → empty.
- **`app/composables/useMapLayers.test.ts` (update):** remove the credential/data-table layer
  cases; keep node-types; adjust to the narrowed `layers` signature.
- **`app/composables/useVisibility.test.ts` (if present):** assert new defaults
  (`resources.dataTables` true, `resources.credentials` false, `overlays.nodeTypes` false).
- Manual: `npm run build` + dev — data tables appear in the layered layout by default below
  their workflows; credentials appear when toggled; both dim on workflow focus; clicking
  opens the correct panel; node-types overlay still works.

## Out of scope

- Server-side resource nodes in `WorkflowGraph`.
- Promoting node-types to first-class.
- Tracing flow *through* a credential/table to other workflows that share it (resources
  remain leaf nodes for focus/trace purposes).
