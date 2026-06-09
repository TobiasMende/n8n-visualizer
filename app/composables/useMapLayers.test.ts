import { describe, it, expect } from 'vitest'
import { overlayNodesAndEdges, overlayNodesAndEdges as overlay2, allNodeTypes } from './useMapLayers'
import type { WorkflowGraph } from '#shared/types/graph'

const graph: WorkflowGraph = {
  nodes: [{ id: 'w', name: 'W', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
    summary: { nodeCount: 1, nodeTypes: [{ type: 'n8n-nodes-base.set', displayName: 'Set', count: 1 }], credentials: ['My API'], inbound: 0, outbound: 0 } }],
  edges: [], triggerNodes: [], unresolved: [], skipped: [],
  webhooks: [], schedules: [],
  credentials: [{ id: '1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['w'] }],
}
const basePos = new Map([['w', { x: 0, y: 0 }]])

describe('overlayNodesAndEdges', () => {
  it('adds nothing when both layers are off', () => {
    const r = overlayNodesAndEdges(graph, basePos, { credentials: false, nodeTypes: false })
    expect(r.nodes).toEqual([])
    expect(r.edges).toEqual([])
  })

  it('adds a credential node + uses edge when credentials layer on', () => {
    const r = overlayNodesAndEdges(graph, basePos, { credentials: true, nodeTypes: false })
    const credNode = r.nodes.find(n => n.kind === 'credential' && n.label === 'My API')
    expect(credNode).toBeDefined()
    expect(r.edges.some(e => e.source === 'w' && e.target === credNode!.id)).toBe(true)
    expect(credNode!.id).toBe('cred:httpHeaderAuth:1')
  })

  it('adds a node-type node + contains edge when nodeTypes layer on', () => {
    const r = overlayNodesAndEdges(graph, basePos, { credentials: false, nodeTypes: true })
    expect(r.nodes.some(n => n.kind === 'nodeType' && n.label === 'Set')).toBe(true)
  })
})

const g2 = {
  nodes: [
    { id: 'w', name: 'W', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 2, nodeTypes: [
        { type: 'n8n-nodes-base.set', displayName: 'Set', count: 1 },
        { type: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request', count: 1 },
      ], credentials: [], inbound: 0, outbound: 0 } },
  ],
  edges: [], unresolved: [], skipped: [], webhooks: [], schedules: [], credentials: [],
} as any
const pos2 = new Map([['w', { x: 0, y: 0 }]])

describe('allNodeTypes', () => {
  it('returns deduped node types sorted by display name', () => {
    expect(allNodeTypes(g2)).toEqual([
      { type: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request' },
      { type: 'n8n-nodes-base.set', displayName: 'Set' },
    ])
  })
})

describe('overlayNodesAndEdges hidden types', () => {
  it('skips node types listed in hiddenNodeTypes', () => {
    const r = overlay2(g2, pos2, { credentials: false, nodeTypes: true }, ['n8n-nodes-base.set'])
    const labels = r.nodes.filter(n => n.kind === 'nodeType').map(n => n.label)
    expect(labels).toEqual(['HTTP Request'])
  })
})

describe('overlayNodesAndEdges credential edge pruning', () => {
  it('produces no edge when workflowId is not in the base graph nodes', () => {
    const graphWithMissing: WorkflowGraph = {
      nodes: [{ id: 'w', name: 'W', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
        summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 } }],
      edges: [], triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [],
      credentials: [{ id: '2', name: 'Other API', type: 'httpHeaderAuth', workflowIds: ['missing-wf'] }],
    }
    const r = overlayNodesAndEdges(graphWithMissing, new Map([['w', { x: 0, y: 0 }]]), { credentials: true, nodeTypes: false })
    expect(r.edges).toHaveLength(0)
  })

  it('produces no node when credential has empty workflowIds', () => {
    const graphEmpty: WorkflowGraph = {
      nodes: [],
      edges: [], triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [],
      credentials: [{ id: '3', name: 'Orphan', type: 'httpHeaderAuth', workflowIds: [] }],
    }
    const r = overlayNodesAndEdges(graphEmpty, new Map(), { credentials: true, nodeTypes: false })
    expect(r.nodes).toHaveLength(0)
    expect(r.edges).toHaveLength(0)
  })
})
