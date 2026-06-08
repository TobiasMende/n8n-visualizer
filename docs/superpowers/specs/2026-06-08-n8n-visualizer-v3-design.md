# n8n Visualizer v3 — Credentials View, Session Persistence, Graph Layers, Webhook Fix

**Date:** 2026-06-08
**Status:** Approved (pending spec review)
**Builds on:** v2 (`2026-06-08-n8n-visualizer-v2-design.md`)

## Summary

Four changes to the running tool:

1. **Fix the Webhooks view** — it shows no rows because the webhook extractor only
   handles one node shape. Harden it against real-world n8n webhook/form-trigger
   shapes so entries actually populate.
2. **Credentials view** — a new rail view listing credentials and which workflows
   use them, mirroring the Webhooks/Schedules views.
3. **Session persistence** — keep the n8n connection (`baseUrl` + `apiKey`) in
   `sessionStorage` so a refresh restores the loaded graph without re-entering
   credentials; auto re-fetch on load; explicit disconnect.
4. **Per-node-type graph layers** — the Map's "Node types" overlay becomes a
   per-type show/hide checklist to declutter the graph.

Single-user, local tool. No auth/billing.

## 1 — Webhooks extraction fix

**Problem:** `graph.webhooks` returns empty for real instances. The current
`webhookPathOf` (in `server/parser/webhook-path.ts`) only accepts
`type === 'n8n-nodes-base.webhook'` with a non-empty `parameters.path`. Real
nodes vary.

**Fix (server):** introduce a dedicated webhook extractor used by `buildWebhooks`
(keep `webhookPathOf` as-is for the link-detection code that already depends on
it — do not change link behavior). The new extractor handles:

- **Node types:** `n8n-nodes-base.webhook` and `n8n-nodes-base.formTrigger`.
- **Path:** `parameters.path` (string, leading/trailing slashes trimmed); if
  empty/missing, fall back to the node-level `webhookId`; if both absent, skip.
- **Method:** `parameters.httpMethod` if a string; else `parameters.options?.httpMethod`;
  else `'GET'`. If `httpMethod` is an array (multi-method webhooks), join with `,`.

`buildWebhooks` uses this extractor (not `webhookPathOf`) so the Webhooks view and
the webhook→HTTP link detection stay decoupled. The `WebhookEntry` shape is
unchanged. Fixture tests cover: path-based node, empty-path + `webhookId`, method
nested under `options`, array `httpMethod`, and a `formTrigger`.

**Note on the unknown:** the real failing node shape was not available during
design, so the fix is defensive across the documented shapes above. If after this
fix a specific instance still shows no rows, the next step is to capture one real
webhook node's JSON and add its shape to the extractor + a test.

## 2 — Credentials view

A new view reachable from the icon rail (4th entry, key icon). It is a client
projection of the existing `graph.credentials` (`CredentialRef[]`), so no server
change.

- **Composable** `app/composables/useCredentialView.ts`:
  - `credentialRows(graph)` → `{ id, name, type, displayType, workflowCount, workflowIds }[]`
    where `displayType` is the readable credential-type label (reuse
    `prettifyType` against the credential `type`, e.g. `httpHeaderAuth` →
    "Http Header Auth"; acceptable heuristic — credential types aren't in the node
    catalog).
  - `credentialWorkflows(graph, id)` → `{ id, name }[]` resolving `workflowIds` to
    workflow names.
- **Component** `app/components/CredentialsView.vue`: a `DataTable` (Name · Type ·
  #Workflows), search + sort, each row expands to list the using workflows; clicking
  a workflow jumps to the Map and selects it. Empty state when none.
- The rail (`AppShell`) gains a `credentials` view id; the store's `ViewId` union
  and the page's `v-if` switch include it.

## 3 — Session persistence

Keep the connection for the tab's lifetime so refresh doesn't lose work.

- **Store** (`app/stores/graph.ts`): on a successful `loadFromApi(baseUrl, apiKey)`,
  save `{ baseUrl, apiKey }` to `sessionStorage` under `n8nviz.conn`. Add:
  - `connectedHost` (computed/derived from saved baseUrl) for display.
  - `disconnect()` — clears `n8nviz.conn`, resets `graph`/`selectedId`/`error`.
  - `restoreConnection()` — reads `n8nviz.conn`; if present, calls
    `loadFromApi(saved.baseUrl, saved.apiKey)` to re-fetch.
- **Bootstrap:** on app mount (client only), call `restoreConnection()` so a
  refresh auto-reconnects. Uploaded-JSON sessions are NOT persisted (no
  credentials, and the JSON isn't retained) — only API connections.
- **UI:** the Toolbar shows, when connected, `Connected to <host>` with a
  **Disconnect** button (calls `disconnect()`), plus a subtle hint: "API key
  stored for this browser session only." `sessionStorage` clears on tab/window
  close.
- **Security:** the key is held in `sessionStorage` in plaintext for the tab
  session. This is documented and intentional for a local single-user tool; it is
  not written to disk like `localStorage`. The existing prefs (`n8nviz.prefs`,
  view/layers/filters) remain in `localStorage`; credentials never go there.

## 4 — Per-node-type graph layers

Make the "Node types" overlay selective so the graph isn't chaotic.

- **Store:** add `hiddenNodeTypes: string[]` (persisted in `n8nviz.prefs`
  alongside `view`/`layers`/`linkTypes`/`tagFilter`).
- **Projection:** `overlayNodesAndEdges(graph, basePos, layers, hiddenNodeTypes)`
  gains the 4th param; when building node-type overlay nodes/edges it skips any
  type in `hiddenNodeTypes`. Credentials overlay is unaffected. Existing call sites
  pass the set.
- **UI:** `app/components/NodeTypeLayerPanel.vue` — shown (e.g. as a popover from
  the "Node types" toggle in `MapLayerToggles`) only when the node-types layer is
  on. Lists every node type present in the graph (readable label, from
  `node.summary.nodeTypes[].displayName`), each a checkbox; checked = visible,
  unchecking adds to `hiddenNodeTypes`. A "show/hide all" affordance. Default: all
  visible (empty `hiddenNodeTypes`).
- A small pure helper `allNodeTypes(graph)` → `{ type, displayName }[]` (deduped,
  sorted by displayName) feeds the panel; unit-tested.

## Architecture & Boundaries

- Server change is isolated to a new `server/webhooks/extract.ts` (the hardened
  webhook node extractor) consumed by `buildWebhooks`; `webhook-path.ts` and link
  detection are untouched.
- New client units are pure composables (`useCredentialView`, `allNodeTypes`) with
  thin components over them, matching the v2 view pattern.
- `overlayNodesAndEdges` gains one parameter; its existing tests are updated to
  pass an empty hidden-set and a new test covers hiding.
- Store grows: `hiddenNodeTypes`, connection persistence + `disconnect`/
  `restoreConnection`, and `credentials` view id.

## Error Handling

- Webhook nodes with neither path nor `webhookId` are skipped (not errored).
- `restoreConnection()` failure (stale/invalid key → 401) surfaces via the
  existing `store.error`; the saved connection is cleared so the user isn't stuck
  in a failing auto-reconnect loop.
- Corrupt `sessionStorage`/`localStorage` JSON is caught and ignored (as today).

## Testing

- **Webhook extractor** — fixtures for path-based, `webhookId`-fallback,
  `options.httpMethod`, array method, `formTrigger`; and that `buildWebhooks`
  yields entries for each.
- **Credentials composable** — `credentialRows` mapping + `displayType`;
  `credentialWorkflows` name resolution.
- **Node-type layers** — `allNodeTypes` dedup/sort; `overlayNodesAndEdges`
  excludes hidden types; existing overlay tests still pass with the new param.
- **Store** — `disconnect()` clears state and `sessionStorage`; `restoreConnection`
  triggers a load when a saved connection exists (mock `$fetch`). SSR-guarded.
- **Components** — light tests already covered by the composables; `CredentialsView`
  not separately unit-tested beyond the composable (consistent with v2 view
  components verified via build + e2e).

## Build Phasing

One spec, implemented in order; each step leaves the app green:

- **P1** — Webhook extractor fix (server + tests) — restores the Webhooks view.
- **P2** — Credentials view (composable + component + rail/store wiring).
- **P3** — Session persistence (store + Toolbar UI + bootstrap).
- **P4** — Per-node-type layers (helper + overlay param + panel + store).

## Out of Scope / Future

- Encrypting the stored key, server-side credential storage, auth — future.
- Light mode; workflow internal drill-down; SaaS plumbing — unchanged direction.
