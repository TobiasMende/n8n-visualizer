# Data Tables + Credential/Data-Table API Enrichment — Design

**Date:** 2026-06-09
**Status:** Approved (pending spec review)

## Goal

Two related additions to n8viz:

1. **Data Tables as a first-class entity** — mirror the existing Credentials feature: a
   list view, graph overlay nodes, a side panel, and a layers toggle, surfacing which n8n
   Data Tables are used by which workflows.
2. **API enrichment for both Credentials and Data Tables** — when the connected API key
   has the right scope, fetch the full credential and data-table lists from the n8n public
   API. This surfaces items **not referenced by any workflow** (orphans) and adds metadata
   (timestamps, data-table columns). When the scope is missing or the connection is
   file-upload only, fall back to the workflow-inferred data that exists today.

## Background — confirmed against the live instance + n8n OpenAPI spec

n8n Data Table node type: `n8n-nodes-base.dataTable`. The table reference is a
resourceLocator stored in `parameters.dataTableId`:

```json
{
  "__rl": true,
  "value": "hhl00MJvClWY80dT",
  "mode": "list",
  "cachedResultName": "Demo",
  "cachedResultUrl": "/projects/fJDEKU806zyxJAwX/datatables/hhl00MJvClWY80dT"
}
```

- `value` → table id
- `cachedResultName` → table name
- `cachedResultUrl` → `projectId` via regex `/projects/([^/]+)/datatables/`
- `parameters.operation` → `insert` (default when absent) / `rowExists` / `get` / `update` / `delete` …

Public API endpoints (both paginate `limit`/`cursor`, same as `/workflows`):

- `GET /api/v1/credentials` → items: `{ id, name, type, isResolvable, createdAt, updatedAt }`
  (no secret `data`, no projectId)
- `GET /api/v1/data-tables` → items:
  `{ id, name, columns: [{ id, name, type, index }], projectId, createdAt, updatedAt }`

Scoped API keys: a key lacking `credential:list` / `dataTable:list` scope returns `403`;
older n8n without the endpoint returns `404`. Both cases → silent fallback to inferred.

## Architecture

Data flows in three layers, matching the existing codebase:

```
n8n API ──┐
          ├─ ingest route (api.post.ts) ─→ buildGraph ─→ WorkflowGraph ─→ Pinia store ─→ views
upload ───┘
```

### 1. Parser — inferred extraction (always runs)

- **New** `server/parser/data-tables.ts` → `extractDataTables(workflows): DataTableRef[]`
  - For each `n8n-nodes-base.dataTable` node, read the `dataTableId` resourceLocator.
  - `id = value`, `name = cachedResultName || value`, `projectId` parsed from
    `cachedResultUrl`, `operation` from `parameters.operation` (default `insert`).
  - **Skip dynamic refs** where `value` is empty or an expression (`mode === 'expression'`
    or value starts with `=`). v1 cannot resolve these; revisit later.
  - Dedupe by `id`; merge `workflowIds` and the `operations` set across all nodes.
  - Every inferred item carries `source: 'inferred'`.
- Existing `server/parser/credentials.ts` is unchanged except its items now carry
  `source: 'inferred'`.
- `build-graph.ts` calls `extractDataTables(valid)` and adds `dataTables` to the returned
  `WorkflowGraph`.

### 2. API fetch — best-effort enrichment

- **Generalize pagination** in `server/ingest/n8n-client.ts`: extract the existing
  `fetchAllWorkflows` loop into a private `fetchAllPaged(base, key, path, opts)` helper.
  `fetchAllWorkflows` becomes a thin caller, preserving its current limits (50 MB response
  cap, 30 s deadline, 200-page cap).
- Add `fetchAllCredentials(base, key)` and `fetchAllDataTables(base, key)` using the helper
  with default (10 MB) caps.
- Each new fetch is wrapped so that `403` / `404` / any `SafeFetchError` resolves to
  `null` (fallback signal). The workflows fetch stays mandatory and keeps its existing
  error handling.

### 3. Merge — in the ingest route

The merge happens server-side so the client always receives a single resolved
`WorkflowGraph`. `buildGraph` gains an optional `opts.apiCredentials` and
`opts.apiDataTables`; when present it merges them with the inferred lists:

- **Credentials**: match API item to inferred by `id` (fallback `type:name`). Result
  `source`: `'both'` if matched, `'api'` if API-only (orphan, empty `workflowIds`),
  `'inferred'` if inferred-only. API contributes `createdAt` / `updatedAt`.
- **Data tables**: match by `id`. API contributes `columns`, authoritative `projectId`,
  and timestamps. Same `source` semantics; API-only tables are orphans with empty
  `workflowIds` / `operations`.

`api.post.ts` calls all three fetches (workflows mandatory; creds + tables best-effort),
then passes the optional lists into `buildGraph`. The upload route (`upload.post.ts`) is
unchanged — no token means no API lists, so everything stays inferred.

## Types (`shared/types/graph.ts`)

```ts
export type EntitySource = 'api' | 'inferred' | 'both'

export interface CredentialRef {
  id: string | null
  name: string
  type: string
  workflowIds: string[]
  source: EntitySource
  createdAt?: string
  updatedAt?: string
}

export interface DataTableColumn { name: string; type: string }

export interface DataTableRef {
  id: string
  name: string
  projectId: string | null
  workflowIds: string[]
  operations: string[]            // e.g. ['insert','rowExists']
  source: EntitySource
  columns?: DataTableColumn[]      // API-only
  createdAt?: string
  updatedAt?: string
}

export interface WorkflowGraph {
  // …existing fields…
  credentials: CredentialRef[]
  dataTables: DataTableRef[]
}
```

## UI

Data Tables fully mirror Credentials.

- **Overlay nodes** (`useMapLayers.ts`): add `kind: 'dataTable'` overlay nodes with
  `uses` edges, colored violet (`#b48cff`). Wire into `WorkflowMap.vue` (node mapping,
  `miniColor`, click → `store.selectedDataTableId`) and `WorkflowNodeCard.vue` styling.
- **Visibility** (`useVisibility.ts`): add `overlays.dataTables` (default `false`).
- **Layers toggle** (`LayersPanel.vue`): add a Data Tables row.
- **List view**: `DataTablesView.vue` + `useDataTableView.ts` composable (parallel to
  `CredentialsView.vue` / `useCredentialView.ts`). Columns: name, project, #workflows,
  read/write operation badges, column count. Deep link to
  `{base}/projects/{projectId}/datatables/{id}`.
- **Side panel**: `DataTablePanel.vue` (mirror `CredentialPanel.vue`) — on node select,
  show using-workflows, operations, and columns.
- **Nav tab** (`AppShell.vue`): add `{ id: 'dataTables', icon: '🗄️', label: 'Data Tables' }`;
  extend `ViewId` in `stores/graph.ts`. Add `selectedDataTableId` + `selectedDataTable`
  to the store.

### Enrichment indicators

- **Orphan badge**: in both `CredentialsView` and `DataTablesView`, items with empty
  `workflowIds` (i.e. `source === 'api'`) show an "unused" badge.
- **Upload-mode hint**: when there is no API connection (`store.connection === null`),
  both list views show a subtle hint: *"Connect with an API token to see unused items and
  column details."*
- **Missing-scope hint**: when connected by API but the credential/data-table list came
  back empty-of-API-source (fetch returned `null`), show a small toolbar note suggesting
  the key be granted `credential:list` / `dataTable:list` scopes for richer data. The
  graph carries a lightweight flag for this (e.g. `enrichment: { credentials: boolean;
  dataTables: boolean }`) set by the ingest route based on whether each API fetch
  succeeded.

## Error handling

- API list fetches never fail the request: any non-200 or fetch error → `null` → inferred
  fallback. Only the workflows fetch can fail the ingest (unchanged behavior).
- Dynamic / expression-mode data-table refs are skipped, not errored.
- Malformed resourceLocators (missing `value`) are skipped defensively.

## Testing

- `server/parser/data-tables.test.ts` (mirror `credentials.test.ts`): static ref,
  missing `cachedResultName` (name falls back to id), dynamic/expression ref skipped,
  dedupe across workflows, operation aggregation, projectId parse from `cachedResultUrl`.
- `server/ingest/n8n-client.test.ts`: add cases for `fetchAllCredentials` /
  `fetchAllDataTables` — pagination, `403`/`404` → `null`.
- Merge unit tests (in `build-graph.test.ts` or a new file): `source` resolution for
  api-only / inferred-only / both; orphan items get empty `workflowIds`.
- Component test for `DataTablesView` orphan badge + upload-mode hint (mirror
  `SidePanel.spec.ts` patterns).

## Out of scope (v1)

- Resolving dynamic/expression data-table references.
- Fetching data-table **rows** or credential **data** (the latter is impossible by design).
- Editing/creating credentials or tables from n8viz.
