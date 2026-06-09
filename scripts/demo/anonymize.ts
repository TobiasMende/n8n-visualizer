import type { RawWorkflow, RawNode } from '#shared/types/graph'
import { Faker, WORKFLOW_NAMES, CRED_NAMES, TAG_NAMES } from './fakes'
import { prettifyType } from '#shared/prettify'

const URL_RE = /^https?:\/\//i
const URI_RE = /^[a-z][a-z0-9+.-]*:\/\//i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CRON_KEYS = new Set(['rule', 'cronExpression', 'triggerTimes', 'interval'])

type Replacer = (s: string) => string

// Single-pass replacement of every known original name with its fake, longest
// match first. Catches names embedded in node parameters — n8n resource
// locators store the referenced workflow/credential name in `cachedResultName`,
// and node expressions reference other nodes by name.
function buildReplacer(replace: Map<string, string>): Replacer {
  const keys = [...replace.keys()].filter(k => k.length >= 4).sort((a, b) => b.length - a.length)
  if (!keys.length) return s => s
  const re = new RegExp(keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g')
  return s => s.replace(re, m => replace.get(m) ?? m)
}

function anonValue(key: string, value: unknown, faker: Faker, replaceStr: Replacer): unknown {
  if (CRON_KEYS.has(key)) return value
  if (typeof value === 'string') {
    if (URL_RE.test(value)) return faker.fakeUrl(value)
    if (URI_RE.test(value)) return 'redacted://demo.example'
    if (EMAIL_RE.test(value)) return 'user@demo.example'
    const r = replaceStr(value)
    return r.length > 24 ? 'Lorem ipsum dolor sit amet.' : r
  }
  if (Array.isArray(value)) return value.map(v => anonValue(key, v, faker, replaceStr))
  if (value && typeof value === 'object')
    return anonParams(value as Record<string, unknown>, faker, replaceStr)
  return value
}

function anonParams(params: Record<string, unknown>, faker: Faker, replaceStr: Replacer): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(params)) {
    if (k === 'path' && typeof v === 'string') { out[k] = faker.webhookPath(v); continue }
    out[k] = anonValue(k, v, faker, replaceStr)
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

interface Prepared {
  wf: RawWorkflow
  fakeWfName: string
  nodeFakes: string[]
  nameMap: Map<string, string>
}

export function anonymizeWorkflows(workflows: RawWorkflow[]): RawWorkflow[] {
  const faker = new Faker()
  const replace = new Map<string, string>()
  const remember = (orig: string | undefined, fake: string) => { if (orig) replace.set(orig, fake) }

  // Pass 1: allocate every name fake exactly once, recording original → fake so
  // names embedded in parameters elsewhere can be scrubbed too.
  const prepared: Prepared[] = workflows.map(wf => {
    const fakeWfName = faker.workflowName(wf.id)
    remember(wf.name, fakeWfName)
    const nameMap = new Map<string, string>()
    const nodeFakes = wf.nodes.map(n => {
      const fake = faker.nodeName(wf.id, n.type)
      nameMap.set(n.name, fake)
      remember(n.name, fake)
      for (const [slot, cred] of Object.entries(n.credentials ?? {}))
        remember(cred.name, faker.credName(cred.id ?? cred.name ?? slot))
      return fake
    })
    for (const t of wf.tags ?? []) {
      const orig = typeof t === 'string' ? t : t.name
      remember(orig, faker.tagName(typeof t === 'string' ? t : (t.id ?? t.name)))
    }
    return { wf, fakeWfName, nodeFakes, nameMap }
  })

  const replaceStr = buildReplacer(replace)

  // Pass 2: rebuild the output from ONLY the fields the app consumes. We do NOT
  // spread `...wf`/`...n`: the n8n API returns extra fields not declared on
  // RawWorkflow/RawNode (pinData, staticData, meta, node `notes`, …) that hold
  // real, unanonymized data. Whitelisting drops every such leak vector.
  return prepared.map(({ wf, fakeWfName, nodeFakes, nameMap }) => {
    const nodes = wf.nodes.map((n, i): RawNode => {
      const out: RawNode = { id: n.id, name: nodeFakes[i], type: n.type }
      if (n.webhookId) out.webhookId = faker.webhookId(n.webhookId)
      if (n.parameters) out.parameters = anonParams(n.parameters, faker, replaceStr)
      if (n.credentials) {
        out.credentials = {}
        for (const [slot, cred] of Object.entries(n.credentials))
          out.credentials[slot] = { id: cred.id, name: faker.credName(cred.id ?? cred.name ?? slot) }
      }
      return out
    })
    const tags = wf.tags?.map(t =>
      typeof t === 'string'
        ? faker.tagName(t)
        : { id: t.id, name: faker.tagName(t.id ?? t.name) })
    let settings: RawWorkflow['settings']
    if (wf.settings) {
      settings = anonParams(wf.settings, faker, replaceStr) as RawWorkflow['settings']
      const origErr = wf.settings.errorWorkflow
      if (typeof origErr === 'string') settings!.errorWorkflow = replace.get(origErr) ?? origErr
    }
    return {
      id: wf.id,
      name: fakeWfName,
      active: wf.active,
      nodes,
      connections: remapConnections(wf.connections, nameMap),
      tags,
      settings,
    }
  })
}

// Residual risk (accepted): bare hostnames-without-scheme and opaque tokens in
// node parameters are neither scrubbed nor netted. Parameter *values* render in
// no view, so they cannot reach the recorded video; the temp JSON is local-only
// and deleted on exit. Detecting them generically risks false-positive aborts.
// The vocabulary our fakes are built from: the pools plus every type-derived
// display name present in the dataset. A name that is a substring of any of
// these can legitimately appear inside an emitted fake (a node named "Tool"
// collides with the fake "Tool Workflow"; a default name equals its type's
// display name), so it must NOT be treated as a leaked secret — only as a
// coincidental, non-identifying overlap. This is self-consistent: if such a
// word shows up in the output it came from one of these fakes.
function fakeVocabulary(workflows: RawWorkflow[]): string[] {
  const types = new Set<string>()
  for (const wf of workflows) for (const n of wf.nodes) types.add(n.type)
  return [...WORKFLOW_NAMES, ...CRED_NAMES, ...TAG_NAMES, ...[...types].map(prettifyType)]
}

function collectSecrets(workflows: RawWorkflow[]): string[] {
  const vocab = fakeVocabulary(workflows)
  const isBenign = (s: string) => vocab.some(v => v.includes(s))
  const out = new Set<string>()
  const addName = (s?: string) => { const t = s?.trim(); if (t && t.length >= 4 && !isBenign(t)) out.add(t) }
  const scan = (value: unknown) => {
    if (typeof value === 'string') {
      if (URI_RE.test(value)) {
        try { out.add(new URL(value).host) } catch { /* ignore */ }
      } else if (EMAIL_RE.test(value)) out.add(value)
      else if (value.length > 24) out.add(value)
      return
    }
    if (Array.isArray(value)) { for (const v of value) scan(v); return }
    if (value && typeof value === 'object') for (const v of Object.values(value)) scan(v)
  }
  for (const wf of workflows) {
    addName(wf.name)
    for (const n of wf.nodes) {
      addName(n.name)
      if (n.webhookId && n.webhookId.trim().length >= 4) out.add(n.webhookId.trim())
      for (const c of Object.values(n.credentials ?? {})) addName(c.name)
      if (n.parameters) scan(n.parameters)
    }
    if (wf.settings) scan(wf.settings)
    for (const t of wf.tags ?? []) addName(typeof t === 'string' ? t : t.name)
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
