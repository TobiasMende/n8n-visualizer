# Webhook Security Indicator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show whether each n8n webhook trigger is authenticated ("secured") or open ("unsecured") in the webhooks table and on the map.

**Architecture:** `webhookNodeInfo()` is the single source of truth. It gains `auth`/`secured` fields that flow into `WebhookEntry` (table) and `TriggerNode` (map) automatically. The table gets a Security column + an open-count summary; the map gets a 🔓 badge on unsecured webhook/form trigger cards.

**Tech Stack:** Nuxt 3, Vue 3 `<script setup>`, TypeScript, Vitest, bun.

---

### Task 1: Extract auth state in `webhookNodeInfo`

**Files:**
- Modify: `server/webhooks/extract.ts`
- Test: `server/webhooks/extract.test.ts`

- [ ] **Step 1: Update existing tests + add auth tests**

Every existing `toEqual` in this file must now include `auth` + `secured`. Replace the whole `describe` body with:

```ts
describe('webhookNodeInfo', () => {
  it('reads path + method from a standard webhook node', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: '/orders', httpMethod: 'POST' } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'orders', method: 'POST', auth: 'none', secured: false })
  })
  it('falls back to webhookId when path is empty', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', webhookId: 'abc-123', parameters: { path: '' } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'abc-123', method: 'GET', auth: 'none', secured: false })
  })
  it('reads method nested under options', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', options: { httpMethod: 'PUT' } } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'p', method: 'PUT', auth: 'none', secured: false })
  })
  it('joins an array of methods', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', httpMethod: ['GET', 'POST'] } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'p', method: 'GET,POST', auth: 'none', secured: false })
  })
  it('handles a form trigger', () => {
    const n: RawNode = { name: 'f', type: 'n8n-nodes-base.formTrigger', parameters: { path: 'signup' } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'signup', method: 'GET', auth: 'none', secured: false })
  })
  it('marks a webhook with header auth as secured', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', authentication: 'headerAuth' } }
    expect(webhookNodeInfo(n)).toMatchObject({ auth: 'headerAuth', secured: true })
  })
  it('marks basicAuth and jwtAuth as secured', () => {
    const mk = (a: string): RawNode => ({ name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', authentication: a } })
    expect(webhookNodeInfo(mk('basicAuth'))).toMatchObject({ secured: true })
    expect(webhookNodeInfo(mk('jwtAuth'))).toMatchObject({ secured: true })
  })
  it('treats explicit none as unsecured', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', authentication: 'none' } }
    expect(webhookNodeInfo(n)).toMatchObject({ auth: 'none', secured: false })
  })
  it('returns null for non-webhook nodes and for nodes with no path/webhookId', () => {
    expect(webhookNodeInfo({ name: 's', type: 'n8n-nodes-base.set' })).toBeNull()
    expect(webhookNodeInfo({ name: 'h', type: 'n8n-nodes-base.webhook', parameters: {} })).toBeNull()
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun run test -- server/webhooks/extract.test.ts`
Expected: FAIL — existing assertions miss `auth`/`secured`.

- [ ] **Step 3: Implement**

Replace the `WebhookNodeInfo` interface and the end of `webhookNodeInfo`:

```ts
export interface WebhookNodeInfo { path: string; method: string; auth: string; secured: boolean }

export function webhookNodeInfo(node: RawNode): WebhookNodeInfo | null {
  if (!WEBHOOK_TYPES.has(node.type)) return null
  const p = node.parameters ?? {}
  let path = typeof p.path === 'string' ? p.path.replace(/^\/+|\/+$/g, '') : ''
  if (!path && typeof node.webhookId === 'string' && node.webhookId) path = node.webhookId
  if (!path) return null
  const raw = p.httpMethod ?? p.options?.httpMethod
  const method = Array.isArray(raw)
    ? raw.join(',')
    : (typeof raw === 'string' && raw ? raw : 'GET')
  const auth = typeof p.authentication === 'string' && p.authentication ? p.authentication : 'none'
  const secured = auth !== 'none'
  return { path, method, auth, secured }
}
```

- [ ] **Step 4: Run test, verify pass**

Run: `bun run test -- server/webhooks/extract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/webhooks/extract.ts server/webhooks/extract.test.ts
git commit -m "feat(webhooks): extract auth/secured state from webhook nodes"
```

---

### Task 2: Carry secured into WebhookEntry and TriggerNode

**Files:**
- Modify: `shared/types/graph.ts`
- Modify: `server/webhooks/build.ts`
- Modify: `server/parser/triggers.ts`
- Test: `server/webhooks/build.test.ts`, `server/parser/triggers.test.ts`

- [ ] **Step 1: Update build + trigger tests**

In `server/webhooks/build.test.ts`, replace the first `expect(got).toEqual([...])` block (the "builds prod/test URLs" test) with auth fields included:

```ts
    expect(got).toEqual([
      { workflowId: 'a', method: 'POST', path: 'orders', auth: 'none', secured: false,
        prodUrl: 'https://n8n.example.com/webhook/orders',
        testUrl: 'https://n8n.example.com/webhook-test/orders' },
      { workflowId: 'a', method: 'GET', path: 'health', auth: 'none', secured: false,
        prodUrl: 'https://n8n.example.com/webhook/health',
        testUrl: 'https://n8n.example.com/webhook-test/health' },
    ])
```

In `server/parser/triggers.test.ts`, the webhook trigger-node test uses `toEqual` — update its expectation to include `secured: false`:

```ts
    expect(got).toEqual([
      { id: 'trig:w1:hook#0', workflowId: 'w1', kind: 'webhook', label: 'POST /orders', secured: false },
    ])
```

Add a new test right after it:

```ts
  it('marks a secured webhook trigger node', () => {
    const got = extractTriggerNodes(wfFull([
      { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'orders', httpMethod: 'POST', authentication: 'headerAuth' } },
    ]), cat)
    expect(got[0]).toMatchObject({ kind: 'webhook', secured: true })
  })
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `bun run test -- server/webhooks/build.test.ts server/parser/triggers.test.ts`
Expected: FAIL — missing `auth`/`secured`.

- [ ] **Step 3: Implement types + producers**

In `shared/types/graph.ts`, extend `WebhookEntry`:

```ts
export interface WebhookEntry {
  workflowId: string
  method: string
  path: string
  auth: string
  secured: boolean
  prodUrl: string | null
  testUrl: string | null
}
```

And `TriggerNode`:

```ts
export interface TriggerNode {
  id: string
  workflowId: string
  kind: TriggerKind
  label: string
  secured?: boolean
}
```

In `server/webhooks/build.ts`, add the two fields to the pushed entry:

```ts
      out.push({
        workflowId: wf.id,
        method: info.method,
        path: info.path,
        auth: info.auth,
        secured: info.secured,
        prodUrl: base ? `${base}/webhook/${info.path}` : null,
        testUrl: base ? `${base}/webhook-test/${info.path}` : null,
      })
```

In `server/parser/triggers.ts`, change the `push` helper to accept an optional `secured`, and pass it for webhook/form:

```ts
function push(out: TriggerNode[], wfId: string, name: string, i: number, kind: TriggerNode['kind'], label: string, secured?: boolean) {
  out.push({ id: `trig:${wfId}:${name}#${i}`, workflowId: wfId, kind, label, ...(secured !== undefined ? { secured } : {}) })
}
```

Then update the form and webhook branches inside `extractTriggerNodes`:

```ts
    if (t === 'n8n-nodes-base.formTrigger') {
      const info = webhookNodeInfo(node)
      push(out, wf.id, node.name, 0, 'form', info ? `Form /${info.path}` : 'Form', info?.secured ?? false)
    } else if (t === 'n8n-nodes-base.webhook') {
      const info = webhookNodeInfo(node)
      push(out, wf.id, node.name, 0, 'webhook', info ? `${info.method} /${info.path}` : 'Webhook', info?.secured ?? false)
    } else if (SCHEDULE.has(t)) {
```

- [ ] **Step 4: Run tests, verify pass**

Run: `bun run test -- server/webhooks/build.test.ts server/parser/triggers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/types/graph.ts server/webhooks/build.ts server/parser/triggers.ts server/webhooks/build.test.ts server/parser/triggers.test.ts
git commit -m "feat(webhooks): carry secured/auth into WebhookEntry and TriggerNode"
```

---

### Task 3: Surface secured + auth label in webhook rows

**Files:**
- Modify: `app/composables/useWebhookView.ts`
- Test: `app/composables/useWebhookView.test.ts`

- [ ] **Step 1: Update + add row tests**

In `app/composables/useWebhookView.test.ts`, the `graph` fixture's `webhooks` array entry now needs `auth`/`secured`. Replace that line with:

```ts
  webhooks: [{ workflowId: 'p', method: 'POST', path: 'orders', auth: 'headerAuth', secured: true, prodUrl: 'https://h/webhook/orders', testUrl: 'https://h/webhook-test/orders' }],
```

Update the `webhookRows` assertion to check the new fields and add a label test:

```ts
describe('webhookRows', () => {
  it('joins each webhook to its workflow name, active state, and security', () => {
    const rows = webhookRows(graph)
    expect(rows[0]).toMatchObject({ workflowId: 'p', workflow: 'Producer', method: 'POST', url: 'https://h/webhook/orders', active: true, secured: true })
  })
  it('maps the auth value to a human label', () => {
    expect(webhookRows(graph)[0].authLabel).toBe('Header Auth')
  })
})
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun run test -- app/composables/useWebhookView.test.ts`
Expected: FAIL — `secured`/`authLabel` undefined.

- [ ] **Step 3: Implement**

In `app/composables/useWebhookView.ts`, extend the interface, add the label map, and populate the rows:

```ts
export interface WebhookRow {
  workflowId: string; workflow: string; method: string; path: string; url: string; active: boolean
  secured: boolean; auth: string; authLabel: string
}

const AUTH_LABELS: Record<string, string> = {
  none: 'None', basicAuth: 'Basic Auth', headerAuth: 'Header Auth', jwtAuth: 'JWT Auth',
}

function authLabelOf(auth: string): string {
  return AUTH_LABELS[auth] ?? auth
}

export function webhookRows(graph: WorkflowGraph | null): WebhookRow[] {
  if (!graph) return []
  const nodeById = new Map(graph.nodes.map(n => [n.id, n]))
  return graph.webhooks.map(w => {
    const wf = nodeById.get(w.workflowId)
    return {
      workflowId: w.workflowId,
      workflow: wf?.name ?? w.workflowId,
      method: w.method,
      path: w.path,
      url: w.prodUrl ?? `/webhook/${w.path}`,
      active: wf?.active ?? false,
      secured: w.secured,
      auth: w.auth,
      authLabel: authLabelOf(w.auth),
    }
  })
}
```

(Leave `callersOf` unchanged.)

- [ ] **Step 4: Run test, verify pass**

Run: `bun run test -- app/composables/useWebhookView.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useWebhookView.ts app/composables/useWebhookView.test.ts
git commit -m "feat(webhooks): expose secured state and auth label in webhook rows"
```

---

### Task 4: Security column, search, and open-count summary in the table

**Files:**
- Modify: `app/components/WebhooksView.vue`

No new unit test — `WebhooksView` has no spec file and the underlying logic (`webhookRows`, search string) is covered by Task 3 and existing `matchesQuery` tests. Verify visually in Step 3.

- [ ] **Step 1: Add the Security column, search term, summary, and styles**

In the `<script setup>`, add the column between Method and URL, and fold the security state into the search string:

```ts
const columns = [
  { key: 'method', label: 'Method' },
  { key: 'security', label: 'Security' },
  { key: 'url', label: 'URL' },
  { key: 'workflow', label: 'Workflow' },
  { key: 'active', label: 'State' },
]

const tagsByWf = computed(() => workflowTagsMap(store.graph))
const rows = computed(() => webhookRows(store.graph).filter(r =>
  tagsMatch(tagsByWf.value.get(r.workflowId) ?? [], store.tagFilter) &&
  matchesQuery(`${r.method} ${r.url} ${r.workflow} ${r.path} ${r.secured ? 'secured' : 'unsecured open'} ${r.authLabel}`, store.searchQuery)))

const openCount = computed(() => rows.value.filter(r => !r.secured).length)
```

In the `<template>`, add the summary line above `<DataTable>` and the security cell slot. The summary:

```vue
    <p v-if="openCount" class="open-summary">{{ openCount }} of {{ rows.length }} webhooks open</p>
    <DataTable :columns="columns" :rows="rows" :row-key="(r) => r.workflowId + '|' + r.path" @row-click="jump">
      <template #cell-method="{ row }"><Badge :tone="row.method === 'POST' ? 'accent' : 'warn'">{{ row.method }}</Badge></template>
      <template #cell-security="{ row }">
        <Badge :tone="row.secured ? 'accent' : 'warn'" :title="row.secured ? row.authLabel : 'No authentication'">
          {{ row.secured ? '🔒 Secured' : '🔓 Open' }}
        </Badge>
      </template>
```

(Leave the remaining cell slots — `url`, `workflow`, `active` — exactly as they are.)

Add to the `<style scoped>` block:

```css
.open-summary { margin: 0 0 8px; color: var(--warn); font-size: 12px; }
```

- [ ] **Step 2: Type-check**

Run: `bunx nuxi typecheck`
Expected: PASS (no errors in `WebhooksView.vue`).

- [ ] **Step 3: Visual verification**

Run: `bun run dev`, open the Webhooks view. Confirm: a Security column shows 🔒 Secured / 🔓 Open; an unsecured webhook shows the "N of M webhooks open" line; typing "unsecured" in search narrows to open webhooks.

- [ ] **Step 4: Commit**

```bash
git add app/components/WebhooksView.vue
git commit -m "feat(webhooks): security column, search, and open-count summary in table"
```

---

### Task 5: Unsecured badge on map trigger cards

**Files:**
- Modify: `app/components/WorkflowMap.vue:95-103` (trigger node data)
- Modify: `app/components/WorkflowNodeCard.vue`
- Test: `app/components/WorkflowNodeCard.spec.ts`

- [ ] **Step 1: Add node-card badge tests**

Append two tests inside the `describe('WorkflowNodeCard', ...)` block in `app/components/WorkflowNodeCard.spec.ts`:

```ts
  it('shows an unsecured badge on an open webhook trigger', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { kind: 'trigger', triggerKind: 'webhook', label: 'Webhook', triggers: [], inbound: 0, dimmed: false, secured: false } }, global: { stubs } })
    expect(w.find('.unsecured').exists()).toBe(true)
    expect(w.text()).toContain('🔓')
  })

  it('shows no unsecured badge on a secured webhook trigger', () => {
    const w = mount(WorkflowNodeCard, { props: { data: { kind: 'trigger', triggerKind: 'webhook', label: 'Webhook', triggers: [], inbound: 0, dimmed: false, secured: true } }, global: { stubs } })
    expect(w.find('.unsecured').exists()).toBe(false)
  })
```

- [ ] **Step 2: Run test, verify it fails**

Run: `bun run test -- app/components/WorkflowNodeCard.spec.ts`
Expected: FAIL — no `.unsecured` element.

- [ ] **Step 3: Implement the badge**

In `app/components/WorkflowNodeCard.vue`, add `secured?: boolean` to the `data` prop type:

```ts
const props = defineProps<{
  data: {
    kind: Kind; label: string; triggers: TriggerType[]; triggerKind?: TriggerKind
    inbound: number; outbound?: number; nodeCount?: number
    dimmed: boolean; selected?: boolean; emphasized?: boolean; secured?: boolean
  }
}>()

const showUnsecured = computed(() =>
  props.data.kind === 'trigger'
  && (props.data.triggerKind === 'webhook' || props.data.triggerKind === 'form')
  && props.data.secured === false)
```

In the `<template>`, add the badge as the first child inside `.node` (after the opening tag, before the `Handle`):

```vue
  <div class="node" :class="[`kind-${data.kind}`, { dimmed: data.dimmed, selected: data.selected, emphasized: data.emphasized }]">
    <span v-if="showUnsecured" class="unsecured" title="Unsecured webhook — no authentication" aria-label="Unsecured webhook">🔓</span>
    <Handle type="target" :position="Position.Left" />
```

Add to `<style scoped>`:

```css
.unsecured { position: absolute; top: -8px; right: -8px; z-index: 2; font-size: 13px;
  background: var(--bg-0); border: 1px solid var(--warn); border-radius: 999px; padding: 0 3px; line-height: 1.4; }
```

- [ ] **Step 4: Run test, verify pass**

Run: `bun run test -- app/components/WorkflowNodeCard.spec.ts`
Expected: PASS.

- [ ] **Step 5: Thread secured from the map layout**

In `app/components/WorkflowMap.vue`, add `secured: t.secured` to the trigger node `data` object (around line 97-102):

```ts
  const trigNodes: Node[] = triggerNodes.value.map(t => ({
    id: t.id, type: 'workflow', position: positions.value.get(t.id) ?? { x: 0, y: 0 },
    data: {
      kind: 'trigger', triggerKind: t.kind, label: t.label, triggers: [],
      workflowId: t.workflowId, inbound: 0, outbound: 0, nodeCount: 0,
      secured: t.secured,
      dimmed: (focused.value && !flow.value.nodeIds.has(t.workflowId)) || (resFocused.value && !resFocus.value!.has(t.workflowId)),
      selected: store.selectedId === t.workflowId,
    },
  }))
```

- [ ] **Step 6: Type-check + visual verification**

Run: `bunx nuxi typecheck`
Expected: PASS.

Then `bun run dev`, open the map: an unsecured webhook/form trigger node shows a 🔓 corner badge; secured ones do not.

- [ ] **Step 7: Commit**

```bash
git add app/components/WorkflowNodeCard.vue app/components/WorkflowNodeCard.spec.ts app/components/WorkflowMap.vue
git commit -m "feat(map): mark unsecured webhook trigger nodes with a badge"
```

---

### Task 6: Full verification

- [ ] **Step 1: Run the whole suite**

Run: `bun run test`
Expected: all pass.

- [ ] **Step 2: Type-check the project**

Run: `bunx nuxi typecheck`
Expected: no errors.
