import { describe, it, expect } from 'vitest'
import { searchGraph } from './useSearch'
import type { WorkflowGraph } from '#shared/types/graph'

const graph: WorkflowGraph = {
  nodes: [
    { id: 'p', name: 'Order Producer', active: true, triggers: ['webhook'], tags: [],
      webhookPaths: ['orders'], deepLink: null,
      summary: { nodeCount: 1, nodeTypes: [{ type: 'n8n-nodes-base.httpRequest', count: 1 }], credentials: [], inbound: 0, outbound: 0 } },
  ],
  edges: [], unresolved: [], skipped: [],
}

describe('searchGraph', () => {
  it('resolves a webhook path to its workflow', () => {
    const hits = searchGraph(graph, 'orders')
    expect(hits).toContainEqual({ workflowId: 'p', label: 'webhook: orders', kind: 'webhook' })
  })

  it('matches workflow names case-insensitively', () => {
    expect(searchGraph(graph, 'producer')[0].workflowId).toBe('p')
  })

  it('returns nothing for a blank query', () => {
    expect(searchGraph(graph, '   ')).toEqual([])
  })

  it('matches a node type and returns a hit with kind node', () => {
    const hits = searchGraph(graph, 'httprequest')
    expect(hits).toContainEqual({ workflowId: 'p', label: 'n8n-nodes-base.httpRequest (×1)', kind: 'node' })
  })
})
