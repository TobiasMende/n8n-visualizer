# Demo Recorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One command records a shareable MP4 screencast of n8n Visualizer driven against a real n8n instance, with all sensitive text anonymized before it ever renders.

**Architecture:** Standalone `scripts/demo/` tooling — zero changes to `app/`/`server/`. Prompt for URL+key → reuse server `fetchAllWorkflows` → anonymize `RawWorkflow[]` in memory (pure, tested) → write temp JSON → launch `bun run dev` → Playwright Chromium drives the real Upload-JSON flow through a fixed tour → record WebM → ffmpeg → MP4 → clean up.

**Tech Stack:** Bun, TypeScript, Playwright (Chromium), ffmpeg, Vitest, reuses `server/ingest/n8n-client.ts` + `#shared/types/graph`.

---

## File Structure

```
scripts/demo/
  fakes.ts            deterministic fake-value pools + keyed name allocator
  fakes.test.ts
  anonymize.ts        RawWorkflow[] → RawWorkflow[] + assertNoLeak
  anonymize.test.ts
  encode.ts           ffmpeg arg builder + runner
  encode.test.ts
  serve.ts            start dev server, waitForServer(), stop()
  serve.test.ts       (waitForServer only)
  prompt.ts           interactive URL + hidden API-key prompt
  tour.ts             fixed Playwright step sequence
  record.ts           orchestrator (entry point)
  out/                .gitignored output dir
```

Selectors the tour relies on (verified in current components):
- Upload file input: `input[type="file"]`
- Upload base-url field: `input[placeholder="instance URL (optional, for links)"]`
- View rail buttons: `nav.rail button[title="Map"|"Webhooks"|"Schedules"|"Credentials"]`
- Map controls: `button[aria-label="Fit view"|"Zoom in"|"Zoom out"]`
- Workflow nodes: `.vue-flow__node` (selecting one auto-triggers trace-flow highlight)

---

## Task 1: Scaffolding & dependencies

**Files:**
- Modify: `package.json` (devDependency + script)
- Create: `scripts/demo/out/.gitignore`
- Modify: `.gitignore`

- [ ] **Step 1: Add Playwright devDependency and a run script**

Run:
```bash
bun add -d playwright
```

Then add to `package.json` `scripts`:
```json
"demo": "bun run scripts/demo/record.ts"
```

- [ ] **Step 2: Install Chromium for Playwright**

Run:
```bash
bunx playwright install chromium
```
Expected: downloads Chromium, prints "Chromium ... downloaded to ...".

- [ ] **Step 3: Ignore generated output**

Create `scripts/demo/out/.gitignore`:
```
*
!.gitignore
```

Append to root `.gitignore`:
```
scripts/demo/out/*.mp4
scripts/demo/out/*.webm
```

- [ ] **Step 4: Commit**

```bash
git add package.json bun.lock scripts/demo/out/.gitignore .gitignore
git commit -m "chore: add playwright + demo recorder scaffolding"
```

---

## Task 2: Fake-value pools (`fakes.ts`)

Deterministic, no RNG (sandbox forbids `Math.random`; also keeps runs reproducible). A `Faker` keeps `Map`s so the same original always maps to the same fake.

**Files:**
- Create: `scripts/demo/fakes.ts`
- Test: `scripts/demo/fakes.test.ts`

- [ ] **Step 1: Write the failing test**

`scripts/demo/fakes.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { Faker } from './fakes'

describe('Faker', () => {
  it('maps the same key to the same fake (workflow names)', () => {
    const f = new Faker()
    const a = f.workflowName('id-1')
    expect(f.workflowName('id-1')).toBe(a)
  })

  it('maps different keys to different fakes', () => {
    const f = new Faker()
    expect(f.workflowName('id-1')).not.toBe(f.workflowName('id-2'))
  })

  it('is deterministic across instances (no RNG)', () => {
    expect(new Faker().workflowName('x')).toBe(new Faker().workflowName('x'))
  })

  it('allocates node names from the node type', () => {
    const f = new Faker()
    const n = f.nodeName('wf1', 'n8n-nodes-base.httpRequest')
    expect(n).toMatch(/HTTP Request/)
  })

  it('keeps credential names stable per key so sharing is preserved', () => {
    const f = new Faker()
    expect(f.credName('cred-9')).toBe(f.credName('cred-9'))
  })

  it('produces a slug for webhook paths', () => {
    const f = new Faker()
    expect(f.webhookPath('p1')).toMatch(/^[a-z0-9-]+$/)
  })

  it('rewrites a url to the demo host, preserving path shape', () => {
    const f = new Faker()
    const out = f.fakeUrl('https://secret.corp.internal/api/orders?id=7')
    expect(out).toContain('demo.example')
    expect(out).not.toContain('secret.corp.internal')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test scripts/demo/fakes.test.ts`
Expected: FAIL — cannot find module `./fakes`.

- [ ] **Step 3: Implement `fakes.ts`**

```ts
import { prettifyType } from '#shared/prettify'

const WORKFLOW_NAMES = [
  'Order Sync', 'Lead Enrichment', 'Invoice Pipeline', 'Support Triage',
  'Daily Digest', 'Inventory Reconcile', 'Signup Onboarding', 'Churn Alert',
  'Payment Retry', 'Report Builder', 'Data Backfill', 'Webhook Relay',
  'Slack Notifier', 'CRM Updater', 'Email Campaign', 'Image Resizer',
]
const CRED_NAMES = [
  'Acme API', 'Mailer SMTP', 'Warehouse DB', 'Billing OAuth',
  'Storage S3', 'Analytics Key', 'Chat Token', 'CRM Account',
]
const TAG_NAMES = ['production', 'internal', 'finance', 'marketing', 'ops', 'experimental']
const SLUG = 'abcdefghijklmnopqrstuvwxyz0123456789'

function pick(pool: string[], i: number): string {
  return i < pool.length ? pool[i] : `${pool[i % pool.length]} ${Math.floor(i / pool.length) + 1}`
}

export class Faker {
  private wf = new Map<string, string>()
  private cred = new Map<string, string>()
  private tag = new Map<string, string>()
  private hook = new Map<string, string>()
  private nodeCounts = new Map<string, number>()

  private alloc(map: Map<string, string>, key: string, pool: string[]): string {
    const hit = map.get(key)
    if (hit) return hit
    const v = pick(pool, map.size)
    map.set(key, v)
    return v
  }

  workflowName(id: string): string { return this.alloc(this.wf, id, WORKFLOW_NAMES) }
  credName(key: string): string { return this.alloc(this.cred, key, CRED_NAMES) }
  tagName(key: string): string { return this.alloc(this.tag, key, TAG_NAMES) }

  nodeName(workflowId: string, type: string): string {
    const base = prettifyType(type)
    const k = `${workflowId}:${base}`
    const n = (this.nodeCounts.get(k) ?? 0) + 1
    this.nodeCounts.set(k, n)
    return n === 1 ? base : `${base} ${n}`
  }

  webhookPath(key: string): string {
    const hit = this.hook.get(key)
    if (hit) return hit
    const i = this.hook.size
    let slug = ''
    let x = i + 1
    for (let j = 0; j < 6; j++) { slug += SLUG[x % SLUG.length]; x = Math.floor(x / SLUG.length) + 7 }
    const v = `hook-${slug}`
    this.hook.set(key, v)
    return v
  }

  fakeUrl(original: string): string {
    try {
      const u = new URL(original)
      return `https://api.demo.example${u.pathname === '/' ? '' : u.pathname}`
    } catch {
      return 'https://api.demo.example'
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test scripts/demo/fakes.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/demo/fakes.ts scripts/demo/fakes.test.ts
git commit -m "feat(demo): deterministic fake-value pools"
```

---

## Task 3: Anonymizer core — names + structure (`anonymize.ts`)

**Files:**
- Create: `scripts/demo/anonymize.ts`
- Test: `scripts/demo/anonymize.test.ts`

- [ ] **Step 1: Write the failing test**

`scripts/demo/anonymize.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { RawWorkflow } from '#shared/types/graph'
import { anonymizeWorkflows } from './anonymize'

const sample: RawWorkflow[] = [{
  id: 'wf-1',
  name: 'ACME Secret Order Flow',
  active: true,
  nodes: [
    { id: 'n1', name: 'Get Orders', type: 'n8n-nodes-base.httpRequest',
      parameters: { url: 'https://secret.corp.internal/orders' },
      credentials: { httpHeaderAuth: { id: 'c-9', name: 'Corp Token' } } },
    { id: 'n2', name: 'Cron', type: 'n8n-nodes-base.scheduleTrigger',
      parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 6 }] } } },
  ],
  connections: { 'Get Orders': { main: [[{ node: 'Cron', type: 'main', index: 0 }]] } },
  tags: [{ id: 't1', name: 'confidential' }],
}]

describe('anonymizeWorkflows — names & structure', () => {
  const out = anonymizeWorkflows(sample)

  it('preserves ids, node ids, types, active', () => {
    expect(out[0].id).toBe('wf-1')
    expect(out[0].nodes[0].id).toBe('n1')
    expect(out[0].nodes[0].type).toBe('n8n-nodes-base.httpRequest')
    expect(out[0].active).toBe(true)
  })

  it('replaces the workflow name', () => {
    expect(out[0].name).not.toBe('ACME Secret Order Flow')
    expect(out[0].name.length).toBeGreaterThan(0)
  })

  it('replaces node and credential and tag names', () => {
    expect(out[0].nodes[0].name).not.toBe('Get Orders')
    expect(out[0].nodes[0].credentials!.httpHeaderAuth.name).not.toBe('Corp Token')
    const tag0 = out[0].tags![0]
    expect(typeof tag0 === 'object' && tag0.name).not.toBe('confidential')
  })

  it('preserves cron rule untouched', () => {
    expect(out[0].nodes[1].parameters!.rule).toEqual(sample[0].nodes[1].parameters!.rule)
  })

  it('does not mutate the input', () => {
    expect(sample[0].name).toBe('ACME Secret Order Flow')
  })

  it('is deterministic', () => {
    expect(anonymizeWorkflows(sample)).toEqual(anonymizeWorkflows(sample))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test scripts/demo/anonymize.test.ts`
Expected: FAIL — cannot find module `./anonymize`.

- [ ] **Step 3: Implement `anonymize.ts` (names + structure; parameter-walk stub passes through cron)**

```ts
import type { RawWorkflow, RawNode } from '#shared/types/graph'
import { Faker } from './fakes'

const URL_RE = /^https?:\/\//i
const CRON_KEYS = new Set(['rule', 'cronExpression', 'triggerTimes', 'interval'])

function anonValue(key: string, value: unknown, faker: Faker): unknown {
  if (CRON_KEYS.has(key)) return value
  if (typeof value === 'string') {
    if (URL_RE.test(value)) return faker.fakeUrl(value)
    return value.length > 24 ? 'Lorem ipsum dolor sit amet.' : value
  }
  if (Array.isArray(value)) return value.map(v => anonValue(key, v, faker))
  if (value && typeof value === 'object')
    return anonParams(value as Record<string, unknown>, faker)
  return value
}

function anonParams(params: Record<string, unknown>, faker: Faker): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    if (k === 'path' && typeof v === 'string') { out[k] = faker.webhookPath(v); continue }
    out[k] = anonValue(k, v, faker)
  }
  return out
}

function anonNode(node: RawNode, workflowId: string, faker: Faker): RawNode {
  const out: RawNode = { ...node, name: faker.nodeName(workflowId, node.type) }
  if (node.parameters) out.parameters = anonParams(node.parameters, faker)
  if (node.credentials) {
    out.credentials = {}
    for (const [slot, cred] of Object.entries(node.credentials)) {
      const key = cred.id ?? cred.name ?? slot
      out.credentials[slot] = { ...cred, name: faker.credName(key) }
    }
  }
  return out
}

function remapConnections(conns: Record<string, any> | undefined, nameMap: Map<string, string>) {
  if (!conns) return conns
  const out: Record<string, any> = {}
  for (const [src, val] of Object.entries(conns)) {
    const newSrc = nameMap.get(src) ?? src
    const json = JSON.stringify(val, (_k, v) =>
      typeof v === 'string' && nameMap.has(v) ? nameMap.get(v) : v)
    out[newSrc] = JSON.parse(json)
  }
  return out
}

export function anonymizeWorkflows(workflows: RawWorkflow[]): RawWorkflow[] {
  const faker = new Faker()
  return workflows.map(wf => {
    const nameMap = new Map<string, string>()
    const nodes = wf.nodes.map(n => {
      const an = anonNode(n, wf.id, faker)
      nameMap.set(n.name, an.name)
      return an
    })
    const tags = wf.tags?.map(t =>
      typeof t === 'string'
        ? faker.tagName(t)
        : { ...t, name: faker.tagName(t.id ?? t.name) })
    return {
      ...wf,
      name: faker.workflowName(wf.id),
      nodes,
      connections: remapConnections(wf.connections, nameMap),
      tags,
    }
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test scripts/demo/anonymize.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/demo/anonymize.ts scripts/demo/anonymize.test.ts
git commit -m "feat(demo): anonymize workflow names, params, connections"
```

---

## Task 4: Parameter & URL anonymization assertions

Add tests proving sensitive parameter values and hosts are scrubbed. Implementation from Task 3 already covers this; this task locks it with tests and fixes any gap.

**Files:**
- Modify: `scripts/demo/anonymize.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `scripts/demo/anonymize.test.ts`:
```ts
describe('anonymizeWorkflows — parameter scrubbing', () => {
  const out = anonymizeWorkflows(sample)

  it('rewrites url params to the demo host', () => {
    const url = out[0].nodes[0].parameters!.url as string
    expect(url).toContain('demo.example')
    expect(url).not.toContain('secret.corp.internal')
  })

  it('replaces webhook path params with a slug', () => {
    const wf: RawWorkflow[] = [{
      id: 'wf-2', name: 'x', nodes: [
        { id: 'h', name: 'Hook', type: 'n8n-nodes-base.webhook',
          parameters: { path: 'super-secret-customer-endpoint', httpMethod: 'POST' } },
      ],
    }]
    const r = anonymizeWorkflows(wf)
    expect(r[0].nodes[0].parameters!.path).not.toBe('super-secret-customer-endpoint')
    expect(r[0].nodes[0].parameters!.httpMethod).toBe('POST')
  })

  it('scrubs long free-text params', () => {
    const wf: RawWorkflow[] = [{
      id: 'wf-3', name: 'x', nodes: [
        { id: 's', name: 'Set', type: 'n8n-nodes-base.set',
          parameters: { text: 'Confidential: customer Jane Doe, card 4111 1111 1111 1111' } },
      ],
    }]
    const r = anonymizeWorkflows(wf)
    const t = r[0].nodes[0].parameters!.text as string
    expect(t).not.toContain('Jane Doe')
    expect(t).not.toContain('4111')
  })
})
```

- [ ] **Step 2: Run tests**

Run: `bun run test scripts/demo/anonymize.test.ts`
Expected: PASS (now 9 tests). If a case fails, adjust `anonValue`/`anonParams` in `anonymize.ts` to satisfy it, then re-run.

- [ ] **Step 3: Commit**

```bash
git add scripts/demo/anonymize.test.ts scripts/demo/anonymize.ts
git commit -m "test(demo): lock parameter and url scrubbing"
```

---

## Task 5: Leak guard (`assertNoLeak`)

**Files:**
- Modify: `scripts/demo/anonymize.ts`
- Modify: `scripts/demo/anonymize.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `scripts/demo/anonymize.test.ts`:
```ts
import { assertNoLeak } from './anonymize'

describe('assertNoLeak', () => {
  it('passes for properly anonymized output', () => {
    expect(() => assertNoLeak(sample, anonymizeWorkflows(sample))).not.toThrow()
  })

  it('throws when an original name survives in the output', () => {
    const leaked = anonymizeWorkflows(sample)
    leaked[0].name = 'ACME Secret Order Flow'
    expect(() => assertNoLeak(sample, leaked)).toThrow(/leak/i)
  })

  it('throws when an original host survives', () => {
    const leaked = anonymizeWorkflows(sample)
    leaked[0].nodes[0].parameters!.url = 'https://secret.corp.internal/orders'
    expect(() => assertNoLeak(sample, leaked)).toThrow(/leak/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test scripts/demo/anonymize.test.ts`
Expected: FAIL — `assertNoLeak` is not exported.

- [ ] **Step 3: Implement `assertNoLeak` in `anonymize.ts`**

Add at end of `anonymize.ts`:
```ts
function collectSecrets(workflows: RawWorkflow[]): string[] {
  const out = new Set<string>()
  const add = (s?: string) => { if (s && s.trim().length >= 4) out.add(s.trim()) }
  for (const wf of workflows) {
    add(wf.name)
    for (const n of wf.nodes) {
      add(n.name)
      for (const c of Object.values(n.credentials ?? {})) add(c.name)
      for (const v of Object.values(n.parameters ?? {})) {
        if (typeof v === 'string' && URL_RE.test(v)) {
          try { add(new URL(v).host) } catch { /* ignore */ }
        }
      }
    }
    for (const t of wf.tags ?? []) add(typeof t === 'string' ? t : t.name)
  }
  return [...out]
}

export function assertNoLeak(original: RawWorkflow[], anonymized: RawWorkflow[]): void {
  const haystack = JSON.stringify(anonymized)
  for (const secret of collectSecrets(original)) {
    if (haystack.includes(secret))
      throw new Error(`Anonymization leak: original value "${secret}" found in output`)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test scripts/demo/anonymize.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/demo/anonymize.ts scripts/demo/anonymize.test.ts
git commit -m "feat(demo): assertNoLeak safety net"
```

---

## Task 6: ffmpeg encoder (`encode.ts`)

**Files:**
- Create: `scripts/demo/encode.ts`
- Test: `scripts/demo/encode.test.ts`

- [ ] **Step 1: Write the failing test**

`scripts/demo/encode.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ffmpegArgs } from './encode'

describe('ffmpegArgs', () => {
  it('builds web-friendly h264 args', () => {
    const args = ffmpegArgs('in.webm', 'out.mp4')
    expect(args).toContain('-i')
    expect(args).toContain('in.webm')
    expect(args).toContain('out.mp4')
    expect(args).toContain('libx264')
    expect(args).toContain('+faststart')
    expect(args).toContain('yuv420p')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test scripts/demo/encode.test.ts`
Expected: FAIL — cannot find module `./encode`.

- [ ] **Step 3: Implement `encode.ts`**

```ts
import { spawnSync } from 'node:child_process'

export function ffmpegArgs(input: string, output: string): string[] {
  return [
    '-y', '-i', input,
    '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264', '-crf', '20',
    output,
  ]
}

export function hasFfmpeg(): boolean {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
}

export function encodeToMp4(input: string, output: string): void {
  if (!hasFfmpeg())
    throw new Error('ffmpeg not found. Install it (macOS: brew install ffmpeg). Keeping WebM.')
  const res = spawnSync('ffmpeg', ffmpegArgs(input, output), { stdio: 'inherit' })
  if (res.status !== 0) throw new Error(`ffmpeg exited with code ${res.status}`)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test scripts/demo/encode.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/demo/encode.ts scripts/demo/encode.test.ts
git commit -m "feat(demo): ffmpeg webm->mp4 encoder"
```

---

## Task 7: Dev server launcher (`serve.ts`)

**Files:**
- Create: `scripts/demo/serve.ts`
- Test: `scripts/demo/serve.test.ts`

- [ ] **Step 1: Write the failing test (readiness poll only)**

`scripts/demo/serve.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { waitForServer } from './serve'

describe('waitForServer', () => {
  it('resolves once the probe returns ok', async () => {
    let calls = 0
    const probe = async () => { calls++; return calls >= 3 }
    await expect(waitForServer('http://x', { probe, intervalMs: 1, timeoutMs: 1000 })).resolves.toBe(true)
    expect(calls).toBe(3)
  })

  it('rejects after the timeout', async () => {
    const probe = async () => false
    await expect(waitForServer('http://x', { probe, intervalMs: 1, timeoutMs: 20 }))
      .rejects.toThrow(/not ready/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test scripts/demo/serve.test.ts`
Expected: FAIL — cannot find module `./serve`.

- [ ] **Step 3: Implement `serve.ts`**

```ts
import { spawn, type ChildProcess } from 'node:child_process'

interface WaitOpts {
  probe?: (url: string) => Promise<boolean>
  intervalMs?: number
  timeoutMs?: number
  now?: () => number
}

async function defaultProbe(url: string): Promise<boolean> {
  try { return (await fetch(url)).ok } catch { return false }
}

export async function waitForServer(url: string, opts: WaitOpts = {}): Promise<boolean> {
  const probe = opts.probe ?? defaultProbe
  const intervalMs = opts.intervalMs ?? 500
  const timeoutMs = opts.timeoutMs ?? 60_000
  const now = opts.now ?? (() => performance.now())
  const start = now()
  for (;;) {
    if (await probe(url)) return true
    if (now() - start > timeoutMs) throw new Error(`Server not ready at ${url} after ${timeoutMs}ms`)
    await new Promise(r => setTimeout(r, intervalMs))
  }
}

export interface RunningServer { url: string; stop: () => void; spawned: boolean }

export async function startServer(url = 'http://localhost:3000'): Promise<RunningServer> {
  if (await defaultProbe(url)) return { url, stop: () => {}, spawned: false }
  const child: ChildProcess = spawn('bun', ['run', 'dev'], {
    stdio: 'ignore', detached: true, env: { ...process.env, TMPDIR: '/tmp' },
  })
  await waitForServer(url, { timeoutMs: 120_000 })
  return {
    url,
    spawned: true,
    stop: () => { try { if (child.pid) process.kill(-child.pid) } catch { /* already gone */ } },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test scripts/demo/serve.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/demo/serve.ts scripts/demo/serve.test.ts
git commit -m "feat(demo): dev server launcher with readiness poll"
```

---

## Task 8: Interactive prompt (`prompt.ts`)

Thin I/O wrapper — no unit test (manual verify). Hides the API key from the terminal echo and shell history.

**Files:**
- Create: `scripts/demo/prompt.ts`

- [ ] **Step 1: Implement `prompt.ts`**

```ts
import * as readline from 'node:readline'

function ask(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    if (hidden) {
      const out = process.stdout
      // @ts-expect-error _writeToOutput is internal but stable
      rl._writeToOutput = (s: string) => { if (s.includes('\n')) out.write('\n') }
    }
    rl.question(question, answer => { rl.close(); resolve(answer.trim()) })
  })
}

export interface Creds { baseUrl: string; apiKey: string; allowLocal: boolean }

export async function promptCreds(argv: string[]): Promise<Creds> {
  const allowLocal = argv.includes('--allow-local')
  const baseUrl = await ask('n8n instance URL (e.g. https://n8n.example.com): ')
  if (!/^https?:\/\//.test(baseUrl)) throw new Error('URL must start with http(s)://')
  const apiKey = await ask('n8n API key (hidden): ', true)
  if (!apiKey) throw new Error('API key is required')
  return { baseUrl, apiKey, allowLocal }
}
```

- [ ] **Step 2: Manual smoke test**

Run: `bun run -e "import('./scripts/demo/prompt.ts').then(m=>m.promptCreds([])).then(c=>console.log('ok', c.baseUrl, c.apiKey.length))"`
Type a URL and key. Expected: key not echoed; prints `ok <url> <keylen>`.

- [ ] **Step 3: Commit**

```bash
git add scripts/demo/prompt.ts
git commit -m "feat(demo): interactive url + hidden key prompt"
```

---

## Task 9: Tour script (`tour.ts`)

Playwright step sequence. Verified manually via the orchestrator in Task 10.

**Files:**
- Create: `scripts/demo/tour.ts`

- [ ] **Step 1: Implement `tour.ts`**

```ts
import type { Page } from 'playwright'

const FAKE_HOST = 'https://n8n.demo.example'
const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function runTour(page: Page, jsonPath: string): Promise<void> {
  // 1. Load app
  await page.goto('http://localhost:3000')
  await page.waitForSelector('.toolbar', { timeout: 30_000 })
  await pause(1000)

  // 2. Upload anonymized JSON via the real Upload-JSON flow
  await page.fill('input[placeholder="instance URL (optional, for links)"]', FAKE_HOST)
  await page.setInputFiles('input[type="file"]', jsonPath)
  await page.waitForSelector('.vue-flow__node', { timeout: 30_000 })
  await pause(1500)

  // 3. Map: fit, zoom, pan, select a node (auto trace-flow), dwell
  await page.click('button[aria-label="Fit view"]')
  await pause(1200)
  await page.click('button[aria-label="Zoom in"]')
  await page.click('button[aria-label="Zoom in"]')
  await pause(1000)
  const node = page.locator('.vue-flow__node').first()
  await node.click()
  await pause(2500)
  await page.click('button[aria-label="Fit view"]')
  await pause(1200)

  // 4. Webhooks
  await page.click('nav.rail button[title="Webhooks"]')
  await pause(3000)

  // 5. Schedules
  await page.click('nav.rail button[title="Schedules"]')
  await pause(3000)

  // 6. Credentials (+ click first credential row if present)
  await page.click('nav.rail button[title="Credentials"]')
  await pause(1500)
  const cred = page.locator('table tbody tr, [role="row"]').first()
  if (await cred.count()) { await cred.click().catch(() => {}); await pause(2500) }

  // 7. Back to map beauty shot
  await page.click('nav.rail button[title="Map"]')
  await page.click('button[aria-label="Fit view"]')
  await pause(2000)
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/demo/tour.ts
git commit -m "feat(demo): scripted four-view tour"
```

---

## Task 10: Orchestrator (`record.ts`) + end-to-end verify

**Files:**
- Create: `scripts/demo/record.ts`

- [ ] **Step 1: Implement `record.ts`**

```ts
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { fetchAllWorkflows } from '../../server/ingest/n8n-client'
import { safeFetch } from '../../server/ingest/safe-fetch'
import { anonymizeWorkflows, assertNoLeak } from './anonymize'
import { startServer } from './serve'
import { runTour } from './tour'
import { encodeToMp4, hasFfmpeg } from './encode'
import { promptCreds } from './prompt'

const OUT_DIR = join(import.meta.dirname, 'out')
const keep = process.argv.includes('--keep')

async function main() {
  const { baseUrl, apiKey, allowLocal } = await promptCreds(process.argv.slice(2))

  console.log('Fetching workflows…')
  const fetchImpl = allowLocal
    ? (async (url: string, init: any) => fetch(url, init) as any)
    : safeFetch
  const raw = await fetchAllWorkflows(baseUrl, apiKey, fetchImpl as any)
  console.log(`Fetched ${raw.length} workflows. Anonymizing…`)

  const anon = anonymizeWorkflows(raw)
  assertNoLeak(raw, anon)
  console.log('Anonymization verified (no leaks).')

  const tmp = mkdtempSync(join(tmpdir(), 'n8nviz-demo-'))
  const jsonPath = join(tmp, 'workflows.json')
  writeFileSync(jsonPath, JSON.stringify({ workflows: anon, baseUrl: 'https://n8n.demo.example' }))

  mkdirSync(OUT_DIR, { recursive: true })
  const server = await startServer()
  console.log(`App ready at ${server.url} (spawned: ${server.spawned})`)

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: tmp, size: { width: 1280, height: 720 } },
  })
  const page = await context.newPage()

  let webm: string | null = null
  try {
    await runTour(page, jsonPath)
  } finally {
    await context.close() // flushes the video file
    await browser.close()
    server.stop()
    const vids = readdirSync(tmp).filter(f => f.endsWith('.webm'))
    webm = vids.length ? join(tmp, vids[0]) : null
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  if (webm) {
    const mp4 = join(OUT_DIR, `n8nviz-demo-${stamp}.mp4`)
    if (hasFfmpeg()) {
      encodeToMp4(webm, mp4)
      console.log(`\n✅ MP4 written: ${mp4}`)
    } else {
      const keptWebm = join(OUT_DIR, `n8nviz-demo-${stamp}.webm`)
      renameSync(webm, keptWebm)
      console.log(`\n⚠️  ffmpeg missing — kept WebM: ${keptWebm} (brew install ffmpeg to get MP4)`)
    }
  } else {
    console.error('No video was recorded.')
  }

  if (!keep) rmSync(tmp, { recursive: true, force: true })
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1) })
```

- [ ] **Step 2: Full type/lint check**

Run: `bun run lint && bun run test`
Expected: lint clean; all demo tests pass alongside the existing suite.

- [ ] **Step 3: End-to-end manual verify**

Run: `bun run demo`
Enter a real instance URL + API key when prompted. Expected:
- "Fetched N workflows. Anonymizing…" → "Anonymization verified (no leaks)."
- App launches, browser drives the tour, no real names/URLs visible at any point.
- Ends with `✅ MP4 written: scripts/demo/out/n8nviz-demo-<stamp>.mp4`.

Open the MP4 and confirm: all four views shown, labels are fake, playback is smooth, ~45–70s.

- [ ] **Step 4: Commit**

```bash
git add scripts/demo/record.ts
git commit -m "feat(demo): orchestrator wiring fetch->anonymize->record->encode"
```

---

## Task 11: Document usage

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a "Recording a demo" section to README**

Insert after the "Scripts" table:
```markdown
## Recording a demo

Generate a shareable MP4 screencast driven against a real instance, with all
sensitive data anonymized before anything renders:

```bash
bun run demo
```

You'll be prompted for your instance URL and API key (key is hidden, never
stored). The script fetches your workflows, replaces every name/URL/credential
with a realistic fake, drives the app through all four views, and writes
`scripts/demo/out/n8nviz-demo-<timestamp>.mp4`.

Flags: `--keep` (retain temp files for debugging), `--allow-local` (permit a
loopback/private self-hosted instance, bypassing the SSRF guard).

Requires `ffmpeg` (macOS: `brew install ffmpeg`) and a one-time
`bunx playwright install chromium`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document demo recorder usage"
```

---

## Self-Review Notes

- **Spec coverage:** anonymize (T3–5), interactive prompt (T8), reuse `fetchAllWorkflows` (T10), upload flow + fake baseUrl (T9–10), four-view tour (T9), WebM→MP4 (T6,T10), assertNoLeak (T5), `--allow-local` SSRF opt-in (T8,T10), `--keep` (T10), ffmpeg-missing fallback (T6,T10), cleanup (T10), no app/server changes (all under `scripts/demo/`), determinism/no-RNG (T2). README (T11).
- **Type consistency:** `anonymizeWorkflows`/`assertNoLeak` (anonymize.ts), `Faker` methods (fakes.ts), `ffmpegArgs`/`encodeToMp4`/`hasFfmpeg` (encode.ts), `waitForServer`/`startServer`/`RunningServer` (serve.ts), `promptCreds`/`Creds` (prompt.ts), `runTour` (tour.ts) — names consistent across tasks.
- **Sandbox note:** `Date.now()`/`new Date()` are used only in `record.ts` (real Node runtime via Bun), never in pure tested modules — fakes use a counter, not RNG.
```
