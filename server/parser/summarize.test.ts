import { describe, it, expect } from 'vitest'
import { summarize, extractTags, extractWebhookPaths } from './summarize'
import type { RawWorkflow } from '#shared/types/graph'

const wf: RawWorkflow = {
  id: 'a', name: 'A',
  tags: [{ id: '1', name: 'prod' }, 'critical'],
  nodes: [
    { name: 'h1', type: 'n8n-nodes-base.httpRequest', credentials: { httpHeaderAuth: { name: 'My API' } } },
    { name: 'h2', type: 'n8n-nodes-base.httpRequest' },
    { name: 's', type: 'n8n-nodes-base.set' },
    { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: '/orders' } },
  ],
}

describe('summarize', () => {
  it('builds a node-type histogram sorted by count', () => {
    const s = summarize(wf)
    expect(s.nodeCount).toBe(4)
    expect(s.nodeTypes[0]).toEqual({ type: 'n8n-nodes-base.httpRequest', count: 2 })
    expect(s.credentials).toEqual(['My API'])
  })
})

describe('extractTags', () => {
  it('normalizes object and string tags to names', () => {
    expect(extractTags(wf)).toEqual(['prod', 'critical'])
  })
})

describe('extractWebhookPaths', () => {
  it('returns webhook paths without leading slashes', () => {
    expect(extractWebhookPaths(wf)).toEqual(['orders'])
  })
})

describe('extractWebhookPaths (unified detector)', () => {
  it('includes form triggers and webhookId-only webhooks', () => {
    const wf = { id: 'w', name: 'W', nodes: [
      { name: 'form', type: 'n8n-nodes-base.formTrigger', parameters: { path: 'signup' } },
      { name: 'wh', type: 'n8n-nodes-base.webhook', webhookId: 'abc-123', parameters: { path: '' } },
    ] } as any
    expect(extractWebhookPaths(wf).sort()).toEqual(['abc-123', 'signup'])
  })
})
