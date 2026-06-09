import { describe, it, expect } from 'vitest'
import { credentialRows, credentialWorkflows } from './useCredentialView'
import type { WorkflowGraph } from '#shared/types/graph'

const graph: WorkflowGraph = {
  nodes: [
    { id: 'a', name: 'Alpha', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 } },
    { id: 'b', name: 'Beta', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 } },
  ],
  edges: [], triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [],
  credentials: [
    { id: '1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['a', 'b'] },
    { id: null, name: 'Slack Bot', type: 'slackApi', workflowIds: ['b'] },
  ],
}

describe('credentialRows', () => {
  it('maps credentials with a readable type and workflow count', () => {
    const rows = credentialRows(graph)
    expect(rows[0]).toMatchObject({ name: 'My API', type: 'httpHeaderAuth', displayType: 'HTTP Header Auth', workflowCount: 2 })
    expect(rows[1]).toMatchObject({ name: 'Slack Bot', displayType: 'Slack API', workflowCount: 1 })
  })
  it('returns [] for a null graph', () => {
    expect(credentialRows(null)).toEqual([])
  })
})

describe('credentialWorkflows', () => {
  it('resolves workflow ids to names for a credential', () => {
    expect(credentialWorkflows(graph, '1', 'httpHeaderAuth', 'My API'))
      .toEqual([{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }])
  })
  it('resolves workflows for a credential with id null', () => {
    expect(credentialWorkflows(graph, null, 'slackApi', 'Slack Bot'))
      .toEqual([{ id: 'b', name: 'Beta' }])
  })
  it('returns [] when credential is not found', () => {
    expect(credentialWorkflows(graph, '999', 'httpHeaderAuth', 'Nonexistent')).toEqual([])
  })
})
