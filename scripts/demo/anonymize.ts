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
