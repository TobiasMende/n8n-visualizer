# n8n Visualizer — Use Cases & Features

A complete guide to what this tool is, who it's for, and why people use it.
Written for someone (human or agent) seeing it for the first time.

## What it is

n8n Visualizer renders an **entire [n8n](https://n8n.io) automation instance as
one interactive map**. Connect via the n8n public API or drop in a workflow JSON
export, and see how every workflow fits together: which ones call each other,
what they trigger on, where webhooks live, when schedules fire, and which
credentials and data tables are shared.

**The core problem it solves:** n8n's own editor shows one workflow at a time.
Once you have dozens or hundreds of workflows calling each other, firing on
schedules, sharing credentials, and exposing webhooks, nobody can hold the whole
picture in their head. This shows all of it at once.

## Who uses it and why

### 1. Onboarding onto an unfamiliar instance
*"I inherited 80 workflows and have no idea what's connected to what."*

- One map of every workflow and how they link (execute / webhook→HTTP / error
  handlers)
- Click any workflow to trace its full upstream and downstream dependency chain
- Jump straight into the n8n editor via deep links

Days of clicking around become minutes.

### 2. Security and compliance audit
*"Which of my webhooks are wide open to the internet?"*

- Webhooks view flags every endpoint as 🔒 Secured or 🔓 Open
- Shows the auth method (Basic Auth / Header Auth / JWT Auth / None)
- Summary warning above the table: "N of M webhooks open"
- Unsecured webhook triggers also carry a 🔓 badge on the map

Find unauthenticated webhooks before an attacker does.

### 3. Credential and secret hygiene
*"What credentials do we use, where, and what's unused?"*

- Every credential listed with usage count and the workflows that use it
- Flags unused credentials (dead secrets to rotate or remove)
- Spot over-shared credentials referenced across many workflows

Reduce attack surface, clean up stale secrets.

### 4. Schedule / cron overview
*"What's firing, when, and what did I forget about?"*

- All schedules in one table, grouped by cadence (sub-minute → monthly → raw cron)
- Live next-fire countdown, refreshed every 30 seconds
- Filter to active-only

Catch overlapping crons, forgotten jobs, and surprise 3am runs.

### 5. Dependency and impact analysis before changes
*"If I change this sub-workflow, what breaks?"*

- Flow tracing highlights everything connected up- and downstream from a node
- Unresolved-link detection finds workflows calling targets that no longer exist

Refactor with confidence; catch broken links early.

### 6. Documentation and stakeholder communication
*"I need to show my client or team how this automation actually works."*

- One clean visual map instead of dozens of editor screenshots
- Click through to trace and explain any dependency chain live

Sell your work, hand off projects, document the system.

### 7. Data table and resource inventory
*"What n8n data tables exist and who touches them?"*

- All data tables with operations (read/write), column counts, and usage
- Flags unused tables

Understand your data layer at a glance.

### 8. Try-before-connect / privacy-sensitive review
*"I can't paste my API key into a random tool."*

- JSON upload mode — drop an exported workflow, no API key, no n8n instance
  required
- When the API is used, the key is sent to the app's server only to fetch your
  workflows, lives only in browser `sessionStorage`, and is never persisted
- Workflows are parsed in memory per request and returned — nothing is stored
  server-side
- SSRF protection and a configured CSP / security headers

Zero-trust friendly. Self-host it or start it locally to keep everything on
your own network.

## Feature reference

### Views

- **Workflow Map** — every workflow as a node; edges for sub-workflow `execute`,
  webhook→HTTP calls, and error-workflow links. Auto-laid-out with a layered
  (Dagre) layout, floating edges, minimap, and pan/zoom.
- **Webhooks** — method, production and test URLs, owning workflow, active
  state, **security indicator with auth type**, copy-to-clipboard URLs, and an
  expandable list of internal HTTP callers.
- **Schedules** — every cron/schedule trigger grouped by cadence, with a live
  next-fire countdown and an active-only filter.
- **Credentials** — every credential with usage count, the workflows that use
  it, and unused flags.
- **Data Tables** — every n8n data table with operations, column counts, usage,
  and unused flags.

### On the map

- Triggers (webhook / schedule / manual / app / form) as first-class,
  color-coded nodes linked to their workflows
- Credentials and data tables rendered as nodes with usage edges (toggleable)
- 🔓 badge on unsecured webhook triggers
- Click-to-center, flow tracing that dims unrelated nodes, hover neighbor
  highlighting

### Navigation and filtering

- Global search across workflow names, webhook paths, and node types (matches
  "secured" / "unsecured" / "open" too), with autocomplete and keyboard nav
- Tag filtering with smart connected-scope (keeps reachable workflows visible)
- Layers panel — toggle trigger kinds, link types, resource visibility, a
  node-type overlay, and hide error handlers

### Details

- Rich per-workflow sidebar: active state, triggers, tags, webhook paths, node
  inventory (count + breakdown by type), credentials, data tables, inbound and
  outbound link counts, clickable jumps to connected items, and "Open in n8n ↗"
- Resource panels for credentials and data tables showing who uses them

### Input and connection

- **Live API** — instance base URL + API key. Fetches workflows, plus
  credentials and data tables when API scopes allow.
- **JSON upload** — paste or upload an exported workflow (or array of
  workflows); optional instance URL for deep links. No API key, no instance
  required.
- Node-type display names resolved live from the instance, cached on disk for 7
  days, with a bundled fallback catalog
- Unresolved / broken inter-workflow link detection
- Session persistence of view, filters, and layer toggles

### Trust and tech

- Workflows parsed in memory on the app's own server and returned; no
  server-side persistence of credentials or workflow data
- API key kept in browser `sessionStorage`, cleared on disconnect
- SSRF protection; CSP and security headers via `nuxt-security`
- Works against n8n Cloud or self-hosted; standalone web app, no editor plugin
- Stack: Nuxt 4 · Vue 3 · Pinia · Vue Flow · Dagre · Nitro · Vitest / Playwright

## What makes it different

1. **One unified graph** — all workflows at once, not one at a time
2. **Cross-workflow relationships** — execute, webhook, and error dependencies
   drawn explicitly
3. **Webhook security audit** built in — open vs secured, with auth type
4. **Schedule overview** — every cron and its next fire time in one table
5. **Credentials and data tables as graph nodes** — see what's used, by whom
6. **Tag-aware scoping** — filtering that keeps connected components visible
7. **One-click flow tracing** of a whole dependency chain
8. **Dual input** — API connection or JSON upload, no instance required to try
