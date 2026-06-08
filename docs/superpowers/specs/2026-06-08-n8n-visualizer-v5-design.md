# n8n Visualizer v5 — Graph Glow-Up (modern, dynamic, interactive)

**Date:** 2026-06-08
**Status:** Approved (pending spec review)
**Builds on:** v4 (`2026-06-08-n8n-visualizer-v4-design.md`)

## Summary

A visual + interaction pass on the Map and the surrounding chrome. No data-model
changes. Goals: a genuinely modern graph (rich node cards, animated flow edges,
dotted-grid canvas), real interactivity (hover highlight, draggable nodes, hover
tooltips, animated transitions, minimap), a **labeled** control bar replacing the
four unlabeled Vue Flow buttons, and a Control-Room restyle of the off-theme
toolbar / tag filter / connect box.

Single-user, local tool. No auth/billing.

## 1 — Node cards (rich)

Restyle `WorkflowNodeCard.vue`:

- Card with a **gradient top-accent bar** colored by entry kind (webhook/schedule/
  app/manual) or neutral for sub-workflows; header row = trigger icon + workflow
  name; meta row = chips for node count and outbound link count.
- States: `:hover` lifts (shadow/glow), `.selected` accent ring + glow, `.dimmed`
  low opacity (focus/tag/visibility dimming — unchanged semantics).
- Overlay kinds keep their distinction: **credential** node = pill with key icon +
  warn accent; **nodeType** node = dashed-accent chip with ◆ icon. Both adopt the
  same token palette so they read as the same family.
- All colors/radii/shadows from `tokens.css` (no new hardcoded hex beyond the
  per-trigger accent map, which lives in one place).

## 2 — Animated flow edges

New custom edge component `FlowEdge.vue` registered as Vue Flow edge type `flow`,
used for all base (workflow) edges:

- Smooth bezier path (Vue Flow `getBezierPath`), **arrowhead** marker at target.
- Stroke color by link type: execute `#3ddc97`, webhookHttp `#10b981`, error
  `#ef4444` (passed via edge `data`).
- **Marching-dash animation** along the path (CSS `stroke-dashoffset` keyframes)
  to convey direction; respects `prefers-reduced-motion` (animation disabled).
- Focus/dim: in-flow edges full opacity + slightly thicker; off-flow edges
  opacity ~0.12; hover-highlight edges brighten. These come from edge `data`
  (`{ type, dimmed, emphasized }`) the Map already computes.
- Overlay edges (credentials/node-types) stay as lightweight dashed lines (built-in
  styling), visually subordinate.

## 3 — Labeled control bar + minimap + background

- New `MapControls.vue`: a styled vertical bar (bottom-left), each control a
  labeled button — **Zoom in**, **Zoom out**, **Fit view**, **Lock** (toggles
  node dragging/selection), **Minimap** (toggles the minimap). Uses
  `useVueFlow(FLOW_ID)`: `zoomIn()`, `zoomOut()`, `fitView()`, and a reactive
  `nodesDraggable`/`elementsSelectable` toggle for Lock. Replaces the default
  `<Controls>` (removed).
- **Minimap** via `@vue-flow/minimap` (`<MiniMap>`), bottom-right, dark-styled
  (node color by kind), shown only when toggled on (default on).
- **Background**: `<Background>` switched to the **dots** variant with
  Control-Room colors (subtle `#1c2640` dots on `--bg-0`).

## 4 — Interactivity

- **Hover highlight** (lighter than click-focus): hovering a workflow node lifts
  it and emphasizes its **1-hop neighbors** + connecting edges; non-neighbors are
  unaffected (no global dim — that's reserved for click-focus). Pure
  `neighbors(edges, id)` → `{ nodeIds, edgeIds }` (1 hop, both directions),
  unit-tested. Wired via `@node-mouse-enter`/`@node-mouse-leave`; a `hoveredId`
  ref drives an `emphasized` flag on nodes/edges. Click-focus (v4) takes
  precedence when a node is selected.
- **Draggable nodes**: enabled (Vue Flow default) and gated by the Lock control.
  Dragging only moves the node visually; positions are not persisted (re-layout on
  data/visibility change is expected).
- **Hover tooltip**: a small `NodeTooltip` shown on node hover with triggers ·
  node count · inbound/outbound — quick info without opening the side panel.
  Implemented inside the node card (CSS/anchored popover on hover) to avoid extra
  Vue Flow plumbing.
- **Animated transitions**: workflow node DOM gets a CSS `transition` on
  `transform`/opacity so position changes (filter/layout/visibility) glide rather
  than snap. (Vue Flow applies node positions via inline transform; the transition
  is a scoped style on the node wrapper. If Vue Flow's positioning fights the
  transition, fall back to transitioning opacity/box-shadow only and document it.)

## 5 — Toolbar / tag filter / connect box restyle

Tokenize `Toolbar.vue` (currently legacy `#fafafa`/blue):

- Container + inputs use `--bg-1/2`, `--border`, `--text`; remove the light theme.
- **Connect**: when disconnected, dark inputs + primary button; when connected,
  collapses to a glassy pill `Connected · <host>  ✕` (✕ = disconnect) — matches the
  mockup. (The connected/disconnect logic already exists from v3.)
- **Search** dropdown: dark surface, hover rows in `--bg-2`.
- **Tags**: render as **chips**; active chip = accent fill (`--accent-dim`/
  `--accent`), inactive = `--bg-3`. Replaces the blue buttons.
- Unresolved-links control: tokenized.

## Architecture & Boundaries

- Pure unit: `app/composables/useNeighbors.ts` (`neighbors(edges, id)`), tested.
- New components: `FlowEdge.vue`, `MapControls.vue`, `NodeTooltip.vue` (or tooltip
  folded into `WorkflowNodeCard`). `WorkflowMap.vue` composes them: registers the
  `flow` edge type, renders `<MiniMap>` + `<MapControls>` + dotted `<Background>`,
  wires hover + lock + minimap-visibility refs. Existing v4 logic (visibleGraph →
  layered layout → traceFlow focus) is unchanged underneath; v5 only changes how
  nodes/edges/chrome are rendered and adds hover.
- `WorkflowNodeCard.vue` and `Toolbar.vue` are restyled (markup tweaks + token
  CSS); their tests stay green (`WorkflowNodeCard.spec` asserts label/trigger/
  dimmed/selected — preserved).
- Dependency: add `@vue-flow/minimap`.
- Map-local UI state (`hoveredId`, `locked`, `showMinimap`) lives in
  `WorkflowMap.vue` (not persisted) except nothing new in the store.

## Error Handling

- `prefers-reduced-motion` → edge dash + node transitions disabled.
- Empty/null graph → controls + background render, minimap empty, no crash.
- Lock toggled → dragging/selection disabled but zoom/fit still work.

## Testing

- **`neighbors`** — 1-hop both directions, excludes 2-hop, empty for null/absent.
- **Components** — `WorkflowNodeCard.spec` updated only if markup keys change
  (keep `data-trigger`, `.dimmed`, `.selected`, label text assertions passing).
  `FlowEdge`/`MapControls`/minimap are verified via build + manual browser check
  (animation, pan/zoom, minimap, hover, drag are inherently visual).
- Build + the existing data-path e2e must stay green.

## Build Phasing

One spec, in order; each step leaves the app green:

- **P1 — Static restyle:** rich node cards, dotted background, tokenized Toolbar/
  tags/connect pill. (Immediate visual lift, no new deps.)
- **P2 — Edges + controls + minimap:** `FlowEdge` animated edge type, custom
  `MapControls` (replacing `<Controls>`), `@vue-flow/minimap`.
- **P3 — Interactivity:** `neighbors` + hover highlight, node hover tooltip,
  draggable/lock wiring, animated transitions.

## Out of Scope / Future

- Persisted manual layouts, edge-bundling, theme switching, light mode — future.
