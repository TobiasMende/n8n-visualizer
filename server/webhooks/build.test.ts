import { describe, it, expect } from 'vitest'
import { buildWebhooks } from './build'
import type { RawWorkflow } from '#shared/types/graph'

const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [
  { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: '/orders', httpMethod: 'POST' } },
  { name: 'noMethod', type: 'n8n-nodes-base.webhook', parameters: { path: 'health' } },
  { name: 'set', type: 'n8n-nodes-base.set' },
] }

describe('buildWebhooks', () => {
  it('builds prod/test URLs and defaults method to GET', () => {
    const got = buildWebhooks([wf], 'https://n8n.example.com/')
    expect(got).toEqual([
      { workflowId: 'a', method: 'POST', path: 'orders', auth: 'none', secured: false,
        prodUrl: 'https://n8n.example.com/webhook/orders',
        testUrl: 'https://n8n.example.com/webhook-test/orders' },
      { workflowId: 'a', method: 'GET', path: 'health', auth: 'none', secured: false,
        prodUrl: 'https://n8n.example.com/webhook/health',
        testUrl: 'https://n8n.example.com/webhook-test/health' },
    ])
  })

  it('leaves URLs null when no base is known', () => {
    const got = buildWebhooks([wf], null)
    expect(got[0].prodUrl).toBeNull()
    expect(got[0].testUrl).toBeNull()
  })
})
