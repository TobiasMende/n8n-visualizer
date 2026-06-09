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

const dtGraph = {
  nodes: [{ id: 'wf1', name: 'WF1', active: true, triggers: [], tags: [], webhookPaths: [],
    summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 }, deepLink: null }],
  edges: [], triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [],
  credentials: [],
  dataTables: [
    { id: 'tbl1', name: 'Demo', projectId: 'p', workflowIds: ['wf1'], operations: ['insert'], source: 'inferred' as const },
    { id: 'tbl2', name: 'Orphan', projectId: 'p', workflowIds: [], operations: [], source: 'api' as const },
  ],
  enrichment: { credentials: false, dataTables: false },
} as unknown as WorkflowGraph

const dtPos = new Map([['wf1', { x: 0, y: 0 }]])

describe('overlayNodesAndEdges dataTables layer', () => {
  it('emits a node + uses edge for used tables and skips orphans', () => {
    const { nodes, edges } = overlayNodesAndEdges(dtGraph, dtPos,
      { credentials: false, nodeTypes: false, dataTables: true })
    expect(nodes.map(n => n.id)).toEqual(['datatable:tbl1'])
    expect(nodes[0]).toMatchObject({ kind: 'dataTable', label: 'Demo' })
    expect(edges).toEqual([{ id: 'e:wf1:datatable:tbl1', source: 'wf1', target: 'datatable:tbl1', kind: 'uses' }])
  })

  it('emits nothing when the layer is off', () => {
    const { nodes } = overlayNodesAndEdges(dtGraph, dtPos,
      { credentials: false, nodeTypes: false, dataTables: false })
    expect(nodes).toEqual([])
  })
})
