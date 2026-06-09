import { describe, it, expect } from 'vitest'
import { overlayNodesAndEdges, allNodeTypes } from './useMapLayers'
import type { WorkflowGraph } from '#shared/types/graph'

const graph = {
  nodes: [{ id: 'w', name: 'W', active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
    summary: { nodeCount: 2, nodeTypes: [
      { type: 'n8n-nodes-base.set', displayName: 'Set', count: 1 },
      { type: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request', count: 1 },
    ], credentials: [], inbound: 0, outbound: 0 } }],
  edges: [], triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [],
  credentials: [], dataTables: [], enrichment: { credentials: false, dataTables: false },
} as unknown as WorkflowGraph
const basePos = new Map([['w', { x: 0, y: 0 }]])

describe('overlayNodesAndEdges', () => {
  it('adds nothing when node-types layer is off', () => {
    const r = overlayNodesAndEdges(graph, basePos, { nodeTypes: false })
    expect(r.nodes).toEqual([])
    expect(r.edges).toEqual([])
  })

  it('adds node-type nodes + contains edges when nodeTypes layer on', () => {
    const r = overlayNodesAndEdges(graph, basePos, { nodeTypes: true })
    expect(r.nodes.map(n => n.label).sort()).toEqual(['HTTP Request', 'Set'])
    expect(r.edges.every(e => e.kind === 'contains')).toBe(true)
  })

  it('skips node types listed in hiddenNodeTypes', () => {
    const r = overlayNodesAndEdges(graph, basePos, { nodeTypes: true }, ['n8n-nodes-base.set'])
    expect(r.nodes.filter(n => n.kind === 'nodeType').map(n => n.label)).toEqual(['HTTP Request'])
  })
})

describe('allNodeTypes', () => {
  it('returns deduped node types sorted by display name', () => {
    expect(allNodeTypes(graph)).toEqual([
      { type: 'n8n-nodes-base.httpRequest', displayName: 'HTTP Request' },
      { type: 'n8n-nodes-base.set', displayName: 'Set' },
    ])
  })
})
