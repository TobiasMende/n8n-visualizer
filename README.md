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
  and test URLs, HTTP methods, and a **security indicator**: 🔒 secured vs 🔓
  open, the auth method (Basic / Header / JWT / None), and a count of how many
  webhooks are unsecured.
- **Schedules view** — every schedule/cron trigger, grouped by cadence
  (sub-minute → monthly → raw cron) with a live next-fire countdown.
- **Credentials view** — which credentials exist, which workflows share them,
  and which are unused.
- **Data tables view** — which n8n data tables are referenced, their operations
  and column counts, which workflows use them, and which are unused.
- **Search, tag filter, and trace flow** — find workflows, filter by tag, and
  follow how data flows between them.
- **Deep links** back to the workflow in your n8n editor.
- **Two ways in**: live API connection, or upload a workflow JSON export — no
  instance required to try it.

For a full breakdown of use cases and features, see
[USE_CASES.md](USE_CASES.md).

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
        │            (live from instance, bundled fallback — never persisted)
        ▼
   WorkflowGraph  →  Vue Flow map + views
```

Node display names are resolved live from the connected instance when available
(used only for the current request, never written to disk), and fall back to a
bundled catalog (`server/catalog/bundled.json`) and finally a prettified type
string. No instance-derived data is persisted server-side.

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
  Settings → API). By default the key is sent to this app's server, used once to
  fetch your workflows, and never stored anywhere. Tick **Remember on this device
  (7 days)** to keep it in an encrypted, httpOnly cookie (sealed server-side, not
  readable by JavaScript) so the connection survives a reload.
- **Upload JSON** — drop an exported workflow (or array of workflows) to explore
  without connecting anything.

### Session secret (remember-me)

The "Remember on this device" option seals the n8n API key into an encrypted,
httpOnly cookie. Set a strong sealing password in production:

```
NUXT_SESSION_PASSWORD=<random string, at least 32 characters>
```

On Vercel, add it under Project → Settings → Environment Variables. If it is
unset in production, remember-me is disabled and the app falls back to the
default behavior (the key is used once per request and never stored). By default
— without remembering — no API key is ever persisted client- or server-side.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Start the dev server on `http://localhost:3000` |
| `bun run build` | Build for production |
| `bun run preview` | Preview the production build |
| `bun run generate` | Static generate |
| `bun run test` | Run the test suite (Vitest) |
| `bun run test:watch` | Run tests in watch mode |

## Recording a demo

Generate a shareable MP4 screencast driven against a real instance, with all
sensitive data anonymized before anything renders:

```bash
bun run demo
```

You'll be prompted for your instance URL and API key (key is hidden, never
stored). The script fetches your workflows, replaces every name/URL/credential
with a realistic fake, drives the app through all five views, and writes
`scripts/demo/out/n8nviz-demo-<timestamp>.mp4`.

Flags: `--keep` (retain temp files for debugging), `--allow-local` (permit a
loopback/private self-hosted instance, bypassing the SSRF guard), `--app-url
<url>` (record against a specific visualizer instead of the local dev server,
e.g. a deployed `https://n8viz.example.com`).

Requires `ffmpeg` (macOS: `brew install ffmpeg`) and a one-time
`bunx playwright install chromium`.

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

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md).

## Support

If this saved you some time, you can buy me a coffee:

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black)](https://www.buymeacoffee.com/TobiMende)

## License

[MIT](LICENSE)

---

Not affiliated with or endorsed by n8n GmbH. "n8n" is a trademark of its
respective owner.
