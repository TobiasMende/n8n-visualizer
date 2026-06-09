import { describe, it, expect } from 'vitest'
import { workflowLinks } from './useWorkflowLinks'
import type { WorkflowGraph } from '#shared/types/graph'

const n = (id: string) => ({ id, name: id.toUpperCase(), active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
  summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 } })
const graph: WorkflowGraph = {
  nodes: [n('a'), n('b'), n('c')],
  edges: [
    { source: 'a', target: 'b', type: 'execute' },
    { source: 'c', target: 'b', type: 'webhookHttp' },
    { source: 'b', target: 'c', type: 'error' },
  ],
  triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [], credentials: [],
}

describe('workflowLinks', () => {
  it('lists inbound links (edges targeting the node) with source name + type', () => {
    const r = workflowLinks(graph, 'b')
    expect(r.inbound).toEqual([
      { id: 'a', name: 'A', type: 'execute' },
      { id: 'c', name: 'C', type: 'webhookHttp' },
    ])
  })
  it('lists outbound links (edges from the node) with target name + type', () => {
    const r = workflowLinks(graph, 'b')
    expect(r.outbound).toEqual([{ id: 'c', name: 'C', type: 'error' }])
  })
  it('returns empty for null graph or unknown id', () => {
    expect(workflowLinks(null, 'b')).toEqual({ inbound: [], outbound: [] })
    expect(workflowLinks(graph, 'zzz')).toEqual({ inbound: [], outbound: [] })
  })
})
