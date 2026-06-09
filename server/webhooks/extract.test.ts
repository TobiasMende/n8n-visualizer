import { describe, it, expect } from 'vitest'
import { webhookNodeInfo } from './extract'
import type { RawNode } from '#shared/types/graph'

describe('webhookNodeInfo', () => {
  it('reads path + method from a standard webhook node', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: '/orders', httpMethod: 'POST' } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'orders', method: 'POST', auth: 'none', secured: false })
  })
  it('falls back to webhookId when path is empty', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', webhookId: 'abc-123', parameters: { path: '' } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'abc-123', method: 'GET', auth: 'none', secured: false })
  })
  it('reads method nested under options', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', options: { httpMethod: 'PUT' } } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'p', method: 'PUT', auth: 'none', secured: false })
  })
  it('joins an array of methods', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', httpMethod: ['GET', 'POST'] } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'p', method: 'GET,POST', auth: 'none', secured: false })
  })
  it('handles a form trigger', () => {
    const n: RawNode = { name: 'f', type: 'n8n-nodes-base.formTrigger', parameters: { path: 'signup' } }
    expect(webhookNodeInfo(n)).toEqual({ path: 'signup', method: 'GET', auth: 'none', secured: false })
  })
  it('marks a webhook with header auth as secured', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', authentication: 'headerAuth' } }
    expect(webhookNodeInfo(n)).toMatchObject({ auth: 'headerAuth', secured: true })
  })
  it('marks basicAuth and jwtAuth as secured', () => {
    const mk = (a: string): RawNode => ({ name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', authentication: a } })
    expect(webhookNodeInfo(mk('basicAuth'))).toMatchObject({ secured: true })
    expect(webhookNodeInfo(mk('jwtAuth'))).toMatchObject({ secured: true })
  })
  it('treats explicit none as unsecured', () => {
    const n: RawNode = { name: 'h', type: 'n8n-nodes-base.webhook', parameters: { path: 'p', authentication: 'none' } }
    expect(webhookNodeInfo(n)).toMatchObject({ auth: 'none', secured: false })
  })
  it('returns null for non-webhook nodes and for nodes with no path/webhookId', () => {
    expect(webhookNodeInfo({ name: 's', type: 'n8n-nodes-base.set' })).toBeNull()
    expect(webhookNodeInfo({ name: 'h', type: 'n8n-nodes-base.webhook', parameters: {} })).toBeNull()
  })
})
