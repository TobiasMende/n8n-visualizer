import { describe, it, expect } from 'vitest'
import { buildGraph } from './build-graph'
import type { RawWorkflow } from '#shared/types/graph'

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
})
