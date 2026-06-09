import type { RawWorkflow, RawNode } from '#shared/types/graph'
import { Faker } from './fakes'

const URL_RE = /^https?:\/\//i
const URI_RE = /^[a-z][a-z0-9+.-]*:\/\//i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CRON_KEYS = new Set(['rule', 'cronExpression', 'triggerTimes', 'interval'])

function anonValue(key: string, value: unknown, faker: Faker): unknown {
  if (CRON_KEYS.has(key)) return value
  if (typeof value === 'string') {
    if (URL_RE.test(value)) return faker.fakeUrl(value)
    if (URI_RE.test(value)) return 'redacted://demo.example'
    if (EMAIL_RE.test(value)) return 'user@demo.example'
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
  if (node.webhookId) out.webhookId = faker.webhookId(node.webhookId)
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
  const globalNames = new Map<string, string>()
  for (const wf of workflows) globalNames.set(wf.name, faker.workflowName(wf.id))
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
    let settings = wf.settings
    if (settings) {
      settings = anonParams(settings, faker) as typeof wf.settings
      const origErr = wf.settings!.errorWorkflow
      if (typeof origErr === 'string') settings!.errorWorkflow = globalNames.get(origErr) ?? origErr
    }
    return {
      ...wf,
      name: faker.workflowName(wf.id),
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
function collectSecrets(workflows: RawWorkflow[]): string[] {
  const out = new Set<string>()
  const add = (s?: string) => { if (s && s.trim().length >= 4) out.add(s.trim()) }
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
    add(wf.name)
    for (const n of wf.nodes) {
      add(n.name)
      add(n.webhookId)
      for (const c of Object.values(n.credentials ?? {})) add(c.name)
      if (n.parameters) scan(n.parameters)
    }
    if (wf.settings) scan(wf.settings)
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
