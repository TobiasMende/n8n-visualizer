# n8n Cross-Workflow Map — v1 Design

**Date:** 2026-06-08
**Status:** Approved (pending spec review)

## Summary

A tool that visualizes how the workflows inside an n8n instance relate to each
other. The core deliverable is a **cross-workflow map**: a force-directed graph
where each node is a whole workflow and each edge is a relationship between two
workflows (a sub-workflow call, a webhook→HTTP link, or an error-handler link).
Highly-referenced workflows surface as visible hubs. Clicking a workflow opens a
side panel summarizing its internals, with a deep link back to the live n8n
instance.

This is the first build. It is deliberately scoped to a **single-user, local
tool** — no authentication, billing, or multi-tenancy. Those belong to later
phases of the eventual SaaS.

## Goals

- Give an instance owner a bird's-eye view that n8n's own per-workflow canvas
  does not provide.
- Detect and render four relationship/classification types reliably:
  Execute-Workflow calls, Webhook→HTTP links, error-workflow links, and
  entry-point (trigger) classification.
- Make per-workflow internals legible without leaving the map (side panel).
- Let the user jump straight from any workflow to that workflow in their n8n
  instance.

## Non-Goals (v1)

- Authentication, user accounts, billing, multi-tenant isolation.
- Persisting API keys or workflow snapshots across sessions.
- Rendering each workflow's full internal node-by-node canvas (drill-down).
- Editing workflows. This is read-only.

## Tech Stack

- **Runtime / package manager:** Bun
- **Framework:** Nuxt 3 (Vue 3, TypeScript), using Nitro server routes
- **Graph rendering:** Vue Flow, with force layout (d3-force; elkjs available if a
  more structured fallback is wanted)
- **State:** Pinia store on the client

## Architecture

Three layers with clean boundaries. The parser is pure and is where the
differentiating logic — and the test coverage — lives.

### 1. Ingest (`server/` Nitro routes)

Two entry points that both normalize to the same `RawWorkflow[]` shape and hand
off to the parser.

- `POST /api/ingest/api` — body `{ baseUrl, apiKey }`. Server-side fetches
  `GET {baseUrl}/api/v1/workflows` (paginated via `cursor`). Running this
  server-side avoids browser CORS and keeps the API key off the client. The key
  is used only for the duration of the request and is **not persisted**.
- `POST /api/ingest/upload` — body is raw workflow JSON: a single workflow, an
  array, or an n8n export bundle. Optional `baseUrl` field so deep links can be
  built for upload-sourced data.

Both return a normalized `WorkflowGraph` (see Parser output).

### 2. Parser (`server/parser/`, pure TypeScript, no I/O)

Operates on `RawWorkflow[]`, returns one `WorkflowGraph`. No network or disk
access → fully unit-testable from JSON fixtures.

- `classifyTriggers(wf)` → entry-point types, derived from trigger nodes:
  webhook, schedule/cron, app-specific triggers, manual. A workflow may have
  several.
- `extractExecuteLinks(wf)` → scan for `n8n-nodes-base.executeWorkflow` nodes,
  read the referenced target workflow ID → outbound edge (type `execute`).
- `extractErrorLink(wf)` → `wf.settings.errorWorkflow`, if set → edge
  (type `error`).
- `extractWebhookHttpLinks(workflows)` → build a map of
  `{ webhook path/full URL → workflowId }` from all webhook trigger nodes, then
  scan every HTTP Request node's URL across all workflows and match against it →
  edge (type `webhookHttp`). **Heuristic:** URLs built from expressions or env
  vars cannot be statically resolved; these are collected into `unresolved`,
  counted, and surfaced in the UI — never silently dropped.
- `summarize(wf)` → node-type histogram (e.g. `3×HTTP Request, 2×Set, 1×IF`),
  list of credentials referenced, node count, inbound/outbound link counts.
  Feeds the side panel.

**Output — `WorkflowGraph`:**

```ts
type LinkType = 'execute' | 'webhookHttp' | 'error'

interface WorkflowNode {
  id: string
  name: string
  active: boolean
  triggers: TriggerType[]
  summary: WorkflowSummary      // histogram, credentials, counts
  deepLink: string | null       // `{baseUrl}/workflow/{id}` or null if no baseUrl
}

interface WorkflowEdge {
  source: string
  target: string
  type: LinkType
}

interface UnresolvedLink {
  workflowId: string
  nodeName: string
  reason: string                // e.g. "URL built from expression"
}

interface WorkflowGraph {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  unresolved: UnresolvedLink[]
  skipped: { name?: string; reason: string }[]   // malformed workflows
}
```

### 3. Viz (`pages/`, `components/`)

- **Vue Flow canvas** with force-directed layout. Custom workflow-node
  component: icon reflects primary trigger type; node size scales with inbound
  link count so hubs grow visibly.
- **Edges** styled by `LinkType`: `execute` solid, `webhookHttp` dashed,
  `error` red.
- **Side panel**: opens on node click. Shows trigger types, node-type
  histogram, credentials used, inbound/outbound links, and an **"Open in n8n"**
  deep link (hidden when `deepLink` is null).
- **Toolbar**: input-source switch (API vs upload), link-type filter toggles,
  and an "Unresolved links (N)" badge that expands the `unresolved` list.

### Deep links

n8n workflow URL pattern is `{baseUrl}/workflow/{id}`. `deepLink` is built at
parse time when a base URL is known (always for API ingest; for upload only when
the user supplies the optional base URL). When null, the "Open in n8n" affordance
is hidden.

## Data Flow

```
input (API creds | uploaded JSON)
  → Nitro ingest route (normalize to RawWorkflow[])
  → parser (pure)  →  WorkflowGraph JSON
  → client Pinia store
  → Vue Flow canvas + side panel
```

## Error Handling

- Invalid API credentials → upstream 401 surfaced as a clear UI error, no crash.
- Malformed / unparseable workflow JSON → that workflow is skipped and recorded
  in `WorkflowGraph.skipped`; the rest render. The skip report is shown to the
  user.
- Webhook→HTTP URLs that can't be statically resolved → collected in
  `unresolved`, counted, and listed in the UI. Never silently dropped.

## Testing

- **Parser** — the core. Fixture-driven unit tests: sample n8n workflow JSON in,
  expected `WorkflowGraph` out. Cover each link type, multi-trigger
  classification, the unresolved-URL heuristic, and malformed-input skipping.
- **Ingest routes** — test normalization of single workflow / array / export
  bundle shapes; test API pagination handling with a mocked fetch.
- **Viz** — light component tests for the side panel given a `WorkflowNode`, and
  for deep-link visibility logic.

## Future Phases (out of scope, noted for direction)

- Auth, accounts, persisted connections and snapshots.
- Full SaaS: billing, plans, multi-tenant isolation, onboarding.
- Workflow internal drill-down (per-workflow node canvas).
