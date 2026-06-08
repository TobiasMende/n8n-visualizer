import { describe, it, expect } from 'vitest'
import { webhookRows, callersOf } from './useWebhookView'
import type { WorkflowGraph } from '#shared/types/graph'

const graph: WorkflowGraph = {
  nodes: [
    { id: 'p', name: 'Producer', active: true, triggers: ['webhook'], tags: [], webhookPaths: ['orders'], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 1, outbound: 0 } },
    { id: 'c', name: 'Consumer', active: false, triggers: [], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 1 } },
  ],
  edges: [{ source: 'c', target: 'p', type: 'webhookHttp' }],
  unresolved: [], skipped: [],
  webhooks: [{ workflowId: 'p', method: 'POST', path: 'orders', prodUrl: 'https://h/webhook/orders', testUrl: 'https://h/webhook-test/orders' }],
  schedules: [], credentials: [],
}

describe('webhookRows', () => {
  it('joins each webhook to its workflow name and active state', () => {
    const rows = webhookRows(graph)
    expect(rows[0]).toMatchObject({ workflowId: 'p', workflow: 'Producer', method: 'POST', url: 'https://h/webhook/orders', active: true })
  })
})

describe('callersOf', () => {
  it('lists workflows that call a webhook owner via HTTP', () => {
    expect(callersOf(graph, 'p')).toEqual([{ id: 'c', name: 'Consumer' }])
  })
})
