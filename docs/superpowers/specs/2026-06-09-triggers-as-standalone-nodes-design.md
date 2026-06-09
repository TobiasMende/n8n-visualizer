# Triggers as Standalone Nodes — Design

**Date:** 2026-06-09
**Status:** Approved

## Problem

Triggers are currently rendered as a corner badge on each workflow node, classified
into a deduped set of types (`webhook | schedule | manual | app | unknown`). This
hides *what* actually triggers a workflow and makes it impossible to see, at a glance,
which trigger fires which workflow.

Additionally, `classifyTriggers` (`server/parser/triggers.ts`) treats any node type
ending in `Trigger` as `app`. `n8n-nodes-base.executeWorkflowTrigger` matches that
rule, so a workflow *called by another workflow* gets a bogus `app` trigger badge —
one of the "connections seem wrong" symptoms.

## Goal

Promote triggers to first-class, standalone graph nodes that point to the workflow
they trigger. Make "which workflow is triggered by what" the primary story.

**Exception:** `executeWorkflowTrigger` ("triggered by other workflow") is NOT a
standalone node — that relationship is already represented by the workflow→workflow
`execute` edge.

## Decisions

- **Granularity: rich.** One node per webhook path+method, per schedule cadence.
  Manual and each app trigger get their own node.
- **Display: always.** Trigger nodes are part of the base graph (not a toggle layer).
- **Badge: removed.** The corner trigger badge / `entryKind` logic on the workflow
  card is removed, since the trigger is now its own node + edge.

## Architecture

Compute trigger nodes **server-side** in `buildGraph`. Single source of truth,
consistent with `webhooks[]` / `schedules[]` (already computed there), and testable
in the parser tests.

### 1. Data model — `shared/types/graph.ts`

```ts
export type TriggerKind = 'webhook' | 'schedule' | 'manual' | 'app' | 'form'

export interface TriggerNode {
  id: string            // `trig:${workflowId}:${nodeName}`
  workflowId: string    // workflow this trigger fires
  kind: TriggerKind
  label: string         // "POST /hook", "every day 09:00", "Slack Trigger", "Manual"
}
```

- Add `triggerNodes: TriggerNode[]` to `WorkflowGraph`.
- Add `'trigger'` to `LinkType` (edge: triggerNode → workflow).

### 2. Server extraction — `server/parser/triggers.ts`

New `extractTriggerNodes(wf, catalog)`: one entry per actual trigger node in the
workflow.

- **Excludes** `n8n-nodes-base.executeWorkflowTrigger`.
- Label by kind:
  - `webhook` (`n8n-nodes-base.webhook`) → `${method} ${path}` (from existing webhook
    extraction helpers).
  - `form` (`formTrigger`) → form path/title.
  - `schedule` (`scheduleTrigger`/`cron`/`interval`) → cadence text (from
    `parseSchedule`).
  - `manual` (`manualTrigger`) → `"Manual"`.
  - `app` (any other `*Trigger`) → catalog display name.
- Node id `trig:${wf.id}:${node.name}` is stable and unique per trigger node.

`buildGraph` collects `triggerNodes` across all valid workflows and emits a
`trigger`-typed edge `{ source: trig.id, target: trig.workflowId, type: 'trigger' }`
for each.

`classifyTriggers` and the `WorkflowNode.triggers` field: retained only if still
consumed after badge removal; otherwise removed. Decide during implementation by
grepping consumers — default is to remove `WorkflowNode.triggers` if nothing else
reads it.

### 3. Layout — `app/composables/useLayeredLayout.ts` + `WorkflowMap.vue`

Trigger nodes join the base node set fed to `computeLayeredLayout` (dagre), with
their `trigger→workflow` edges, so dagre places them upstream (left) of the workflow
they fire. They do NOT use the radial `place()` positioning used by the
credential/nodeType overlays.

### 4. Visibility — `app/composables/useVisibility.ts`

`triggerKinds` now filters **trigger nodes** (and their edges) in/out, instead of
hiding whole workflows by `entryKind`:

- `visibleGraph` includes trigger nodes whose `kind` is enabled; drops trigger edges
  whose trigger node is hidden.
- `entryKindOf` and the entry-based workflow filtering are removed.
- `Visibility.triggerKinds` keys become `TriggerKind` (add `form`, drop `none`).

### 5. Rendering

- `app/components/WorkflowNodeCard.vue`:
  - Add `kind: 'trigger'`. Render a small node: kind icon (⚡ webhook, ⏰ schedule,
    ▶ manual, 🧩 app, 📝 form) + label. Source handle only (points to workflow).
  - **Remove** the corner trigger badge (`.trig`), `entryKind`, and the
    `triggers`-based tooltip rows from the workflow card.
- `app/composables/edgeColors.ts`: add a `'trigger'` color.
- `WorkflowMap.vue`: map trigger nodes/edges into VueFlow; `miniColor` gets a trigger
  color; `onNodeClick` — trigger nodes are non-selectable (or select their target
  workflow — default: no-op, like nodeType nodes).

### 6. Filter UI

Wherever `triggerKinds` toggles are rendered (controls/legend), update the key set to
the new `TriggerKind` values (add `form`, drop `none`).

## Testing

- Parser: `extractTriggerNodes` — one node per webhook path, per schedule, per manual,
  per app trigger; `executeWorkflowTrigger` excluded; multiple triggers on one
  workflow; correct labels per kind.
- `buildGraph` — emits `triggerNodes` + `trigger` edges; no `app` badge leakage for
  execute-triggered workflows.
- Visibility — disabling a `triggerKind` hides matching trigger nodes and their edges,
  not the workflows.

## Out of Scope

- Changes to `execute` / `webhookHttp` / `error` edge semantics.
- Changes to the webhooks/schedules side panels (they keep using `webhooks[]` /
  `schedules[]`).

## Affected Files

- `shared/types/graph.ts`
- `server/parser/triggers.ts`
- `server/parser/build-graph.ts`
- `app/composables/useVisibility.ts`
- `app/composables/useLayeredLayout.ts` (if layout input signature needs widening)
- `app/composables/edgeColors.ts`
- `app/components/WorkflowMap.vue`
- `app/components/WorkflowNodeCard.vue`
- Trigger-filter control/legend component
- Corresponding test files
