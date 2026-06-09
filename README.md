# n8n Visualizer

Visualize an entire [n8n](https://n8n.io) instance as a map. Connect to the n8n
public API (or drop in a workflow JSON export) and explore how your workflows
fit together: which ones call each other, what they trigger on, where webhooks
live, when schedules fire, and which credentials are shared.

n8n's own editor shows you one workflow at a time. This shows you all of them at
once.

## Features

- **Workflow map** — every workflow as a node, edges drawn between workflows
  that link to each other (sub-workflow `execute`, HTTP-to-webhook calls, error
  workflows). Auto-laid-out with a layered (Dagre) layout and floating edges.
- **Webhooks view** — every webhook path across the instance, with production
  and test URLs and HTTP methods.
- **Schedules view** — every schedule/cron trigger, grouped by cadence
  (sub-minute → monthly → raw cron) with the next fire time.
- **Credentials view** — which credentials exist and which workflows share them.
- **Search, tag filter, and trace flow** — find workflows, filter by tag, and
  follow how data flows between them.
- **Deep links** back to the workflow in your n8n editor.
- **Two ways in**: live API connection, or upload a workflow JSON export — no
  instance required to try it.

## How it works

```
n8n API / JSON upload
        │
        ▼
  server/ingest      normalize raw workflows
        │
        ▼
  server/parser      build the cross-workflow graph
        │            (links, triggers, credentials, webhooks, schedules)
        ▼
  server/catalog     resolve node type → display name
        │            (live from instance, cached on disk, bundled fallback)
        ▼
   WorkflowGraph  →  Vue Flow map + views
```

Node display names are resolved from the connected instance when available,
cached on disk for 7 days (`.cache/`), and fall back to a bundled catalog
(`server/catalog/bundled.json`) and finally a prettified type string.

## Quick start

Requires [Bun](https://bun.sh) (or npm/pnpm/yarn).

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

### Connecting to n8n

In the toolbar, either:

- **Connect via API** — enter your instance base URL (e.g.
  `https://n8n.example.com`) and an n8n API key
  ([create one](https://docs.n8n.io/api/authentication/) under
  Settings → API). The key is sent to this app's server only to fetch your
  workflows and is kept in the browser `sessionStorage` for the session — it is
  never persisted server-side.
- **Upload JSON** — drop an exported workflow (or array of workflows) to explore
  without connecting anything.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Start the dev server on `http://localhost:3000` |
| `bun run build` | Build for production |
| `bun run preview` | Preview the production build |
| `bun run generate` | Static generate |
| `bun run test` | Run the test suite (Vitest) |
| `bun run test:watch` | Run tests in watch mode |

## Tech stack

[Nuxt 4](https://nuxt.com) · [Vue 3](https://vuejs.org) ·
[Pinia](https://pinia.vuejs.org) · [Vue Flow](https://vueflow.dev) ·
[Dagre](https://github.com/dagrejs/dagre) · [Vitest](https://vitest.dev)

## Project layout

```
app/          Nuxt app — pages, components, stores, composables
server/       Server logic
  ingest/       fetch from n8n API + normalize uploads
  parser/       build the cross-workflow graph
  catalog/      node type → display-name resolution
  schedule/     cron parsing + next-fire calculation
  webhooks/     webhook path extraction
  api/          Nitro endpoints (ingest/api, ingest/upload)
shared/       types + utilities shared between app and server
```

## Deployment

The app works as a server proxy: the **server** fetches your workflows from the
n8n API, so a user's API key and workflows pass through it in memory (never
written to disk, never logged).

**Run it on a Node serverless runtime** (Vercel/Netlify Node functions, a
container, or a VPS) — **not a true edge runtime** (CF Workers, Vercel Edge).
The SSRF guard needs Node's DNS resolution and socket pinning, which edge
runtimes don't provide.

What's already hardened for public hosting:

- **SSRF guard** (`server/ingest/safe-fetch.ts`) — all outbound calls to a
  user-supplied host resolve DNS first, reject private/loopback/link-local/CGNAT
  /cloud-metadata addresses, pin the connection to the validated IP (defeats DNS
  rebinding), re-validate every redirect hop, and cap the response size.
- **XSS** — `baseUrl` is scheme-checked server-side and deep-link hrefs are
  validated client-side, so a crafted `javascript:` URL in an upload can't run.
- **Body-size cap** — uploads over 5 MB are rejected (`413`).
- **CSP + security headers** via `nuxt-security` (`connect-src 'self'` —
  the browser only talks to this origin).

Still required before heavy public traffic:

- **Rate limiting.** Not yet implemented. A public proxy is otherwise abusable
  as free compute. Add a per-IP limiter backed by an external store (e.g.
  Upstash Redis) — in-memory limiters don't work across serverless invocations.

Note: the on-disk node-catalog cache (`.cache/`) is a no-op on ephemeral
serverless disks, so node display names are re-fetched on cold start. Swapping
it for a KV store is future work.

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)

---

Not affiliated with or endorsed by n8n GmbH. "n8n" is a trademark of its
respective owner.
