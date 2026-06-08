import { describe, it, expect } from 'vitest'
import { extractExecuteLinks, extractErrorLink, extractWebhookHttpLinks } from './links'
import type { RawWorkflow } from '#shared/types/graph'

describe('extractExecuteLinks', () => {
  it('reads target id from a string workflowId param', () => {
    const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [
      { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: 'b' } },
    ] }
    expect(extractExecuteLinks(wf)).toEqual([{ source: 'a', target: 'b', type: 'execute' }])
  })

  it('reads target id from a resource-locator object param', () => {
    const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [
      { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: { value: 'c', mode: 'list' } } },
    ] }
    expect(extractExecuteLinks(wf)).toEqual([{ source: 'a', target: 'c', type: 'execute' }])
  })

  it('ignores execute nodes with no resolvable target', () => {
    const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [
      { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: { value: '', mode: 'list' } } },
    ] }
    expect(extractExecuteLinks(wf)).toEqual([])
  })
})

describe('extractErrorLink', () => {
  it('builds an edge from settings.errorWorkflow', () => {
    const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [], settings: { errorWorkflow: 'eh' } }
    expect(extractErrorLink(wf)).toEqual({ source: 'a', target: 'eh', type: 'error' })
  })

  it('returns null when no error workflow is set', () => {
    expect(extractErrorLink({ id: 'a', name: 'A', nodes: [] })).toBeNull()
  })
})

describe('extractWebhookHttpLinks', () => {
  const producer: RawWorkflow = { id: 'p', name: 'Producer', nodes: [
    { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'orders' } },
  ] }
  const consumer: RawWorkflow = { id: 'c', name: 'Consumer', nodes: [
    { name: 'http', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://n8n.example.com/webhook/orders' } },
  ] }

  it('links an HTTP node URL to the workflow exposing that webhook path', () => {
    const { edges } = extractWebhookHttpLinks([producer, consumer])
    expect(edges).toEqual([{ source: 'c', target: 'p', type: 'webhookHttp' }])
  })

  it('flags expression URLs as unresolved instead of dropping them', () => {
    const exprConsumer: RawWorkflow = { id: 'c', name: 'C', nodes: [
      { name: 'http', type: 'n8n-nodes-base.httpRequest', parameters: { url: '={{ $json.endpoint }}' } },
    ] }
    const { edges, unresolved } = extractWebhookHttpLinks([producer, exprConsumer])
    expect(edges).toEqual([])
    expect(unresolved).toEqual([{ workflowId: 'c', nodeName: 'http', reason: 'URL built from expression' }])
  })

  it('does not link a workflow to its own webhook', () => {
    const selfRef: RawWorkflow = { id: 's', name: 'S', nodes: [
      { name: 'hook', type: 'n8n-nodes-base.webhook', parameters: { path: 'x' } },
      { name: 'http', type: 'n8n-nodes-base.httpRequest', parameters: { url: 'https://h/webhook/x' } },
    ] }
    expect(extractWebhookHttpLinks([selfRef]).edges).toEqual([])
  })
})
