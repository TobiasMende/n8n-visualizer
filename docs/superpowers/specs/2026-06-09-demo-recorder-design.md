# Demo Recorder — Design

Date: 2026-06-09
Status: Approved (pending spec review)

## Goal

Produce a short MP4 screencast of n8n Visualizer driven against a **real** n8n
instance, but with all sensitive text replaced by realistic fakes so the video
is safe to share publicly. One command, interactive prompt for the instance
URL + API key, deterministic scripted tour through all four views.

## Non-goals

- No blurring / redaction (data is anonymized instead, so nothing sensitive is
  ever rendered).
- No changes to `app/` or `server/` production code.
- No permanent in-product "demo mode".
- No narration/audio (silent screencast).

## Approach

Standalone script under `scripts/demo/`. It:

1. Prompts for instance URL + API key (interactive, key hidden, never written to
   disk or shell history).
2. Fetches all workflows by reusing the server's `fetchAllWorkflows`.
3. Anonymizes the `RawWorkflow[]` in memory (pure, unit-tested function).
4. Writes the anonymized JSON to a temp file (deleted on exit).
5. Launches the app (`bun run dev`), waits for it to be ready.
6. Drives a Playwright (Chromium) browser through a fixed scripted tour, using
   the real **Upload JSON** entry point with a fake `baseUrl`
   (`https://n8n.demo.example`) so webhook prod/test URLs render with a safe
   host.
7. Records WebM video, then transcodes to MP4 with `ffmpeg`.
8. Cleans up: closes browser, stops dev server, deletes temp JSON + WebM.

Everything sensitive is gone *before* the browser ever loads it — the anonymized
JSON is the only data the app sees.

## Components

```
scripts/demo/
  record.ts        orchestrator: prompt → fetch → anonymize → serve → drive → encode → clean
  anonymize.ts     pure: RawWorkflow[] → RawWorkflow[]  (the security-critical unit)
  anonymize.test.ts
  tour.ts          fixed step sequence (selectors, dwell times, pan/zoom/click)
  serve.ts         start `bun run dev`, await readiness on http://localhost:3000, return stop()
  encode.ts        webm → mp4 via ffmpeg (fail clearly if ffmpeg missing)
```

### anonymize.ts — the security-critical unit

Input: `RawWorkflow[]` from the live API. Output: same shape, structure intact,
all human-readable/identifying strings replaced.

**Replace (consistently — same input maps to same fake every time, via keyed
maps so cross-references still resolve):**

| Field | Treatment |
| --- | --- |
| `workflow.name` | Fake themed name (`"Order Sync"`, `"Lead Enrichment"`, …). Keyed by workflow `id` so edges/links by name stay consistent. |
| `node.name` | Fake name derived from its `type` (`"HTTP Request 1"`), keyed within the workflow. |
| `node.credentials[].name` | Fake cred name keyed by `id ?? originalName`, so credential *sharing* across workflows is preserved. |
| `tags[].name` | Fake tag from a fixed palette, keyed by tag id/name. |
| webhook `path` params (`parameters.path`) | Fake slug (`"wh/a1b2c3"`), keyed so prod/test URL pair stays consistent. |
| URL/host-like string values anywhere in `parameters` | Rewritten to `https://api.demo.example/...`, host-consistent so HTTP→webhook link detection still fires. |
| free-text param values (e.g. `parameters.text`, queries, bodies) | Replaced with lorem-style filler. |

**Preserve exactly (graph correctness depends on it):**
`id`, `node.id`, `node.type`, `webhookId`, `connections`, `settings.errorWorkflow`,
cron expressions (`parameters.rule` / schedule params), `active`, node `type`
counts, trigger types.

**Strategy:** deep-clone, then walk. Maintain `Map`s (`workflowNames`,
`credNames`, `tagNames`, `webhookPaths`) so a given original always yields the
same fake. Names drawn deterministically from fixed themed pools indexed by a
running counter — **no** `Math.random()` (keeps runs reproducible and dodges the
sandbox `Math.random` restriction; if pools exhaust, suffix with the counter).

**Safety net:** after anonymizing, a `assertNoLeak(original, anonymized)` check
scans the output JSON for any original workflow/cred/tag name or the original
host; throws if found. Recording aborts rather than risk a leak.

### tour.ts — fixed scripted tour

Deterministic sequence with timed dwells (tuned constants). Target ~45–70s.

1. Open `http://localhost:3000`, wait for app shell.
2. Open the **Connect** `<details>`, fill the upload `instance URL` field with
   `https://n8n.demo.example`, `setInputFiles` the anonymized JSON.
3. Wait for the map to render; brief settle pause.
4. **Map:** fit view, slow zoom-in on a cluster, pan, click a workflow node →
   side panel opens, trigger trace-flow, dwell.
5. **Webhooks** view: switch, dwell on the table (paths + methods + prod/test
   URLs with fake host).
6. **Schedules** view: switch, dwell on cadence groups + next-fire times.
7. **Credentials** view: switch, dwell, click a credential → panel showing
   sharing across workflows.
8. Return to **Map**, final fit-view beauty shot.

Selectors sourced from existing components (`Toolbar.vue`, view components,
`data-*`/role/text). Where a stable selector is missing, the tour adds a
`data-testid` **only if** unavoidable — but first preference is existing
role/text selectors so production code stays untouched.

### serve.ts

Spawn `bun run dev` as a child process, poll `http://localhost:3000` until 200,
return a `stop()` that kills the process group. If port 3000 is already taken,
detect a running instance and reuse it (skip spawn) — log which path was taken.

### encode.ts

`ffmpeg -i tour.webm -movflags +faststart -pix_fmt yuv420p -c:v libx264 -crf 20
out.mp4`. Preflight `which ffmpeg`; if absent, fail with an actionable message
(`brew install ffmpeg`) and leave the WebM so the run isn't wasted.

## Output

`scripts/demo/out/n8nviz-demo-<timestamp>.mp4` (timestamp passed in from the
orchestrator's wall clock — not generated inside any sandboxed pure module).
1280×720, ~30fps. Path printed at the end.

## Dependencies

- **Add** `@playwright/test` (or `playwright`) as a devDependency, plus
  `bunx playwright install chromium`.
- **System:** `ffmpeg` (already present at `/opt/homebrew/bin/ffmpeg`).
- Reuses `server/ingest/n8n-client.ts` (`fetchAllWorkflows`) and
  `#shared/types/graph`.

## Error handling

- Bad URL/key or fetch failure → surface n8n's error, exit non-zero, no browser
  launched.
- `assertNoLeak` failure → abort, delete all artifacts, exit non-zero.
- ffmpeg missing → keep WebM, print install hint.
- Any failure → temp JSON + WebM cleaned unless `--keep` is passed for debugging.
- `safeFetch` blocks private/loopback hosts (SSRF guard). For a localhost n8n
  instance the script accepts a `--allow-local` flag that swaps in a plain
  `fetch` (explicit opt-in, documented as for self-hosted local instances only).

## Testing

- `anonymize.test.ts` (Vitest, fits existing suite): structure preserved (ids,
  types, connections, cron untouched); names replaced; credential-sharing keys
  stable; URL hosts rewritten consistently; `assertNoLeak` passes on output and
  throws on a planted leak; determinism (same input → same output, no RNG).
- Tour/orchestrator verified by running the script end-to-end against a real
  instance and watching the MP4.

## Open questions

None blocking. Tour timing constants tuned during implementation against the
real recording.
