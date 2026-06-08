import { describe, it, expect } from 'vitest'
import { overlayNodesAndEdges } from './useMapLayers'
import type { WorkflowGraph } from '#shared/types/graph'

const graph: WorkflowGraph = {
  nodes: [{ id: 'w', name: 'W', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
    summary: { nodeCount: 1, nodeTypes: [{ type: 'n8n-nodes-base.set', displayName: 'Set', count: 1 }], credentials: ['My API'], inbound: 0, outbound: 0 } }],
  edges: [], unresolved: [], skipped: [],
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
    expect(r.nodes.some(n => n.kind === 'credential' && n.label === 'My API')).toBe(true)
    expect(r.edges.some(e => e.source === 'w' && e.target.includes('My API'))).toBe(true)
  })

  it('adds a node-type node + contains edge when nodeTypes layer on', () => {
    const r = overlayNodesAndEdges(graph, basePos, { credentials: false, nodeTypes: true })
    expect(r.nodes.some(n => n.kind === 'nodeType' && n.label === 'Set')).toBe(true)
  })
})
