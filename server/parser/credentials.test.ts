import { describe, it, expect } from 'vitest'
import { extractCredentials } from './credentials'
import type { RawWorkflow } from '#shared/types/graph'

const a: RawWorkflow = { id: 'a', name: 'A', nodes: [
  { name: 'h', type: 'n8n-nodes-base.httpRequest', credentials: { httpHeaderAuth: { id: '1', name: 'My API' } } },
] }
const b: RawWorkflow = { id: 'b', name: 'B', nodes: [
  { name: 'h', type: 'n8n-nodes-base.httpRequest', credentials: { httpHeaderAuth: { id: '1', name: 'My API' } } },
  { name: 's', type: 'n8n-nodes-base.slack', credentials: { slackApi: { name: 'Slack Bot' } } },
] }

describe('extractCredentials', () => {
  it('dedupes a shared credential and lists referencing workflows', () => {
    const got = extractCredentials([a, b])
    const api = got.find(c => c.name === 'My API')!
    expect(api).toEqual({ id: '1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['a', 'b'] })
  })

  it('captures a credential without an id', () => {
    const got = extractCredentials([b])
    expect(got.find(c => c.name === 'Slack Bot')).toEqual({ id: null, name: 'Slack Bot', type: 'slackApi', workflowIds: ['b'] })
  })
})
