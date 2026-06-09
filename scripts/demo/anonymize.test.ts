import { describe, it, expect } from 'vitest'
import type { RawWorkflow } from '#shared/types/graph'
import { anonymizeWorkflows, assertNoLeak } from './anonymize'

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
