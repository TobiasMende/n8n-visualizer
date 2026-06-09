import { describe, it, expect } from 'vitest'
import { buildGraph } from './build-graph'
import type { RawWorkflow } from '#shared/types/graph'
import type { NodeCatalog } from '../catalog/catalog'

const producer: RawWorkflow = { id: 'p', name: 'Producer', active: true, nodes: [
  { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'orders' } },
] }
const consumer: RawWorkflow = { id: 'c', name: 'Consumer', nodes: [
  { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: 'p' } },
  { name: 'http', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://h/webhook/orders' } },
] }

describe('buildGraph', () => {
  it('produces nodes with inbound/outbound counts and a deep link', () => {
    const g = buildGraph([producer, consumer], 'https://n8n.example.com/')
    const p = g.nodes.find(n => n.id === 'p')!
    const c = g.nodes.find(n => n.id === 'c')!
    expect(p.summary.inbound).toBe(2)   // execute + webhookHttp both target p
    expect(c.summary.outbound).toBe(2)
    expect(p.deepLink).toBe('https://n8n.example.com/workflow/p')
  })

  it('sets deepLink to null when no base URL is given', () => {
    const g = buildGraph([producer], null)
    expect(g.nodes[0].deepLink).toBeNull()
  })

  it('drops edges pointing at unknown workflows', () => {
    const lone: RawWorkflow = { id: 'x', name: 'X', nodes: [
      { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: 'missing' } },
    ] }
    expect(buildGraph([lone], null).edges).toEqual([])
  })

  it('de-duplicates identical edges so counts are not inflated', () => {
    const caller: RawWorkflow = { id: 'a', name: 'A', nodes: [
      { name: 'c1', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: 'b' } },
      { name: 'c2', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: 'b' } },
    ] }
    const target: RawWorkflow = { id: 'b', name: 'B', nodes: [] }
    const g = buildGraph([caller, target], null)
    expect(g.edges).toEqual([{ source: 'a', target: 'b', type: 'execute' }])
    expect(g.nodes.find(n => n.id === 'b')!.summary.inbound).toBe(1)
    expect(g.nodes.find(n => n.id === 'a')!.summary.outbound).toBe(1)
  })

  it('skips malformed workflows but keeps the rest', () => {
    const bad = { name: 'no id' } as unknown as RawWorkflow
    const g = buildGraph([producer, bad], null)
    expect(g.nodes.map(n => n.id)).toEqual(['p'])
    expect(g.skipped).toEqual([{ name: 'no id', reason: 'missing id or nodes' }])
  })

  it('emits standalone trigger nodes pointing at their workflow', () => {
    const g = buildGraph([producer, consumer], null)
    const trigs = g.triggerNodes.filter(t => t.workflowId === 'p')
    expect(trigs).toHaveLength(1)
    expect(trigs[0]).toMatchObject({ workflowId: 'p', kind: 'webhook', label: 'GET /orders' })
  })

  it('does not emit a trigger node for executeWorkflowTrigger workflows', () => {
    const sub: RawWorkflow = { id: 's', name: 'Sub', nodes: [
      { name: 't', type: 'n8n-nodes-base.executeWorkflowTrigger' },
    ] }
    const g = buildGraph([sub], null)
    expect(g.triggerNodes).toHaveLength(0)
  })

  it('returns empty dataTables and unset enrichment by default', () => {
    const g = buildGraph([{ id: 'a', name: 'A', nodes: [] }], null)
    expect(g.dataTables).toEqual([])
    expect(g.enrichment).toEqual({ credentials: false, dataTables: false })
  })
})

const stubCatalog: NodeCatalog = { displayName: (t) => (t === 'n8n-nodes-base.webhook' ? 'Webhook' : t) }

describe('buildGraph enrichment', () => {
  const wf: RawWorkflow = { id: 'w', name: 'W', active: true, nodes: [
    { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', httpMethod: 'POST' } },
    { name: 's', type: 'n8n-nodes-base.scheduleTrigger', parameters: { rule: { interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 2, triggerAtMinute: 0 }] } } },
    { name: 'h', type: 'n8n-nodes-base.httpRequest', credentials: { httpHeaderAuth: { id: '1', name: 'My API' } } },
  ] }

  it('attaches webhooks, schedules, credentials and readable node-type names', () => {
    const g = buildGraph([wf], 'https://n8n.example.com', { from: '2026-06-08T00:00:00.000Z', catalog: stubCatalog })
    expect(g.webhooks).toHaveLength(1)
    expect(g.webhooks[0].prodUrl).toBe('https://n8n.example.com/webhook/p')
    expect(g.schedules[0].cadenceText).toBe('Every day at 02:00')
    expect(g.schedules[0].nextFire).toBe('2026-06-08T02:00:00.000Z')
    expect(g.credentials.find(c => c.name === 'My API')!.workflowIds).toEqual(['w'])
    const wh = g.nodes[0].summary.nodeTypes.find(t => t.type === 'n8n-nodes-base.webhook')!
    expect(wh.displayName).toBe('Webhook')
  })

  it('still works with no opts (v1 call style)', () => {
    const g = buildGraph([wf], null)
    expect(g.webhooks[0].prodUrl).toBeNull()
    expect(g.schedules[0].nextFire).toBeNull()
    expect(g.nodes[0].summary.nodeTypes[0].displayName).toBeTypeOf('string')
  })
})
