# n8n Visualizer v2 — Views, Enrichment & Visual Overhaul

**Date:** 2026-06-08
**Status:** Approved (pending spec review)
**Builds on:** v1 cross-workflow map (`2026-06-08-n8n-cross-workflow-map-design.md`)

## Summary

v2 turns the single-graph v1 tool into a polished, multi-view product. It adds
three things on top of the existing cross-workflow map:

1. **Data enrichment** — readable node-type names (live n8n catalog + cache),
   full webhook URLs with HTTP methods, parsed schedule/cron cadences with
   next-fire times, and credentials as first-class data.
2. **Three views** — **Map** (the existing force graph, restyled, with
   toggleable credential / node-type overlay nodes), **Webhooks** (a URL table
   plus an optional caller graph), and **Schedules** (a grouped-cadence list with
   next-fire).
3. **A real design system** — the "Control Room" dark aesthetic: a design-token
   foundation and reusable UI primitives, applied across the app so it looks and
   feels outstanding.

Still a single-user, local tool. No auth/billing (those remain future phases).

## Goals

- Make the instance legible at a glance and pleasant to use — "people want to use it".
- Answer concrete operator questions directly: *which URL triggers which
  workflow?* (Webhooks view) and *when does which schedule fire?* (Schedules view).
- Replace cryptic node-type identifiers with human-readable names everywhere.
- Let credentials and node types optionally appear as nodes in the map.

## Non-Goals (v2)

- Auth, accounts, billing, multi-tenancy.
- Editing workflows (read-only).
- Per-workflow internal node-by-node canvas (still deferred).
- Real-time/live updating; data is loaded on demand as in v1.

## Design Language — "Control Room" (dark)

A dark, premium aesthetic: deep slate backgrounds, glassy elevated panels, a
green accent (`#3ddc97`) for primary/active and live state, amber (`#ffb454`) and
red (`#ef4444`) for secondary/error edges, soft glow on accent edges.

Implemented as a **design-token layer** (CSS custom properties) plus reusable
primitives — not ad-hoc per-component styles:

- **Tokens** (`app/assets/tokens.css`): color palette (bg-0..bg-3, border, text,
  text-dim, accent, warn, danger), radii, elevation/shadow, spacing scale, font
  stacks, motion (durations, easings).
- **UI primitives** (`app/components/ui/`): `AppShell`, `IconRail`, `TopBar`,
  `Panel`, `Badge`, `IconButton`, `DataTable`, `EmptyState`, `Skeleton`. Each is
  small, single-purpose, and reused by the views.
- Focus-visible states, hover transitions, loading skeletons, and empty states
  are part of the primitives so every screen gets them for free.

Light mode is out of scope for v2 but the token layer makes it a later toggle.

## Navigation & Shell

- A left **icon rail** switches the active view: **Map**, **Webhooks**,
  **Schedules**. The active view is highlighted; the rail is the primary nav.
- A **top bar** holds: the data source / instance indicator, global search, and
  global controls (Map layer toggles when on Map; theme placeholder).
- The active view, Map layer toggles, and link-type filters persist to
  `localStorage` so a reload restores the workspace.

## Data Enrichment (server)

All enrichment extends the single server-built `WorkflowGraph`; v1 fields are
preserved. Each unit below is pure (except the catalog's network fetch, which is
isolated behind an interface) and fixture-tested.

### Node catalog resolver (`server/catalog/`)

Produces a `type → { displayName, iconHint? }` map used wherever a node type is
shown. **Layered resolution**, first hit wins, results cached:

1. **Disk cache** — `.cache/node-catalog-<host>.json` (per instance host), with a
   TTL (e.g. 7 days). Read first; write on any successful live fetch.
2. **Live fetch (best-effort)** — attempt the instance's node-catalog endpoint
   when ingesting via API. This may fail (the endpoint may not accept API-key
   auth, or upload mode has no instance); failure is non-fatal.
3. **Bundled snapshot** — `server/catalog/bundled.json`, a checked-in map of
   common n8n node types → official display names. Covers the long tail of
   built-in nodes offline.
4. **Heuristic prettify** — for anything still unknown (community nodes): strip
   the package prefix (`n8n-nodes-base.`, `@n8n/n8n-nodes-*.`), split camelCase,
   Title-Case, and fix known acronyms (HTTP, API, URL, AI, S3, etc.).

The resolver is injected into graph building so node-type labels are resolved
once, server-side.

### Webhook details (`server/webhooks/`)

For each `n8n-nodes-base.webhook` (and form-trigger) node, extract `httpMethod`
(default `GET`/`POST` per node config) and `path`, and build the full callable
URLs from the instance base: production `{base}/webhook/{path}` and test
`{base}/webhook-test/{path}`. Output a `WebhookEntry[]` keyed to the owning
workflow.

### Schedule parsing (`server/schedule/`)

Two functions:

- `parseSchedule(node)` → for `scheduleTrigger` (interval rules: seconds/minutes/
  hours/days/weeks/cron-expression field) and legacy `cron`, produce a normalized
  `{ cadenceText, cadenceGroup, cronExpr? }`. `cadenceText` is human ("Every 15
  minutes", "Daily · 02:00", "Mondays · 09:00"). `cadenceGroup` is a coarse
  bucket for grouping (`sub-minute | minutes | hourly | daily | weekly | monthly
  | cron`).
- `nextFire(schedule, from)` → next occurrence as an ISO timestamp using cron math
  (library, e.g. `cron-parser`), `null` if not computable. `from` is passed in
  (no hidden clock) so it is deterministically testable.

### Credentials (`server/parser/`)

Promote the credentials already collected per workflow into first-class
`CredentialRef { id?, name, type }` with the set of workflows that reference each.

### Extended data model (`shared/types/graph.ts`)

Added to the existing types (v1 fields unchanged):

```ts
interface NodeTypeCount { type: string; displayName: string; count: number } // + displayName

interface WebhookEntry {
  workflowId: string
  method: string
  path: string
  prodUrl: string
  testUrl: string
}

interface ScheduleEntry {
  workflowId: string
  cadenceText: string
  cadenceGroup: 'sub-minute' | 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'cron'
  nextFire: string | null   // ISO; computed with `from` supplied at build time
}

interface CredentialRef { id: string | null; name: string; type: string; workflowIds: string[] }

interface WorkflowGraph {
  // ...v1 fields...
  webhooks: WebhookEntry[]
  schedules: ScheduleEntry[]
  credentials: CredentialRef[]
}
```

`buildGraph` gains a `from: string` parameter (current time, supplied by the
route) for next-fire computation, and the catalog resolver for display names.

## Views (client projections of the one graph)

Each view is a thin Vue component over a dedicated composable that projects the
loaded `WorkflowGraph`. No additional server round-trips.

### Map view

The v1 force graph, restyled in Control Room, with hub sizing and link-type edge
styling retained. New: **layer toggles** in the top bar, default **Workflows only**:

- **Credentials layer** — adds a node per `CredentialRef` and an edge
  workflow→credential ("uses").
- **Node-types layer** — adds a node per distinct node type (readable label) and
  an edge workflow→type ("contains").

Overlay nodes are visually distinct (shape/color) from workflow nodes. Toggling a
layer attaches/detaches its nodes around their workflows **without re-running the
base workflow layout** (overlay positions are derived by a light radial/attached
placement around each parent, so the workflow map stays stable). The side panel
is restyled and shows the readable node-type histogram, credentials, links, and
the deep link.

### Webhooks view

Primary: a `DataTable` of all `WebhookEntry`s — columns Method · full URL ·
workflow · active state. Sortable, text-filterable, with copy-URL on each row.
Clicking a row selects that workflow and jumps to the Map. Each row expands to
list internal callers (workflows that hit this webhook via HTTP Request, derived
from the existing `webhookHttp` edges).

A view-level toggle swaps to a **caller graph**: each webhook URL as a node, with
edges from caller workflows (HTTP) and to its owning workflow (triggers). Reuses
the Vue Flow canvas component.

### Schedules view

A grouped list: sections ordered by `cadenceGroup` (sub-minute → cron). Each row
shows the workflow name, `cadenceText`, a live next-fire countdown (from
`nextFire`), and active state. Clicking a row selects the workflow and jumps to
the Map. Search box and an "active only" filter.

## Architecture & Boundaries

- **Server pure units** (fixture-tested): `catalog/resolve.ts` (+ `prettify.ts`,
  `bundled.json`), `webhooks/build.ts`, `schedule/parse.ts`, `schedule/group.ts`,
  `schedule/next-fire.ts`, plus extended `parser/build-graph.ts` and credentials.
  The catalog's network call sits behind a small `CatalogSource` interface so the
  resolver is testable without the network.
- **Client**: one composable per view (`useMapLayers`, `useWebhookView`,
  `useScheduleView`) holding the projection logic (pure, unit-tested); thin Vue
  components render them. Design-system primitives live in `app/components/ui/`.
- **State**: the Pinia store holds the loaded graph plus view state (active view,
  map layers, link-type filters, tag filter), persisted to `localStorage`.
- The server still returns one `WorkflowGraph`; all three views are client
  projections of it.

## Error Handling

- Catalog live fetch failure → silently fall through to bundled + heuristic; never
  blocks ingest. A one-line note records which source was used.
- Unparseable schedule (exotic cron) → `cadenceText` falls back to the raw
  expression, `cadenceGroup: 'cron'`, `nextFire: null`; the row still renders.
- Webhook path built from an expression → URL shown as the raw template, flagged
  (consistent with v1's unresolved handling); never silently dropped.
- v1's malformed-workflow skipping and API-error surfacing are unchanged.

## Testing

- **Catalog** — resolver layering (cache hit, live hit cached, bundled hit,
  heuristic fallback) with a stubbed `CatalogSource`; `prettify` acronym/casing
  cases.
- **Schedules** — `parseSchedule` across interval rules and cron expressions;
  `nextFire` with a fixed `from` for deterministic assertions; `group` ordering.
- **Webhooks** — `build` URL construction (prod/test, method defaults, base-URL
  trailing slash), caller derivation from `webhookHttp` edges.
- **Composables** — `useScheduleView` grouping/sorting, `useWebhookView` filter +
  caller expansion, `useMapLayers` overlay node/edge generation and stable base
  layout.
- **Components** — light `@vue/test-utils` tests for `DataTable` (sort/filter) and
  a Schedules row (countdown formatting), following v1's component-test pattern.

## Build Phasing

One spec, implemented as three phases; each leaves the app working and tested.

- **P1 — Enrichment + data model:** catalog resolver, webhook/schedule/credential
  extraction, extended `WorkflowGraph`, route wiring (`from` time). Server-only,
  fully unit-tested; existing UI keeps working.
- **P2 — Design system + Map upgrade:** tokens + UI primitives, app shell with the
  icon rail, restyled Map, credential/node-type layer toggles, restyled side panel.
- **P3 — Webhooks & Schedules views:** the URL table + caller graph, the grouped
  cadence list with next-fire, view switching and persistence.

## Future Phases (unchanged direction)

- Auth, accounts, persisted snapshots; full SaaS (billing, multi-tenant); light
  mode; workflow internal drill-down.
