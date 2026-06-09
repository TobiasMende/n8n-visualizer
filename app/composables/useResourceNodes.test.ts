import { describe, it, expect } from 'vitest'
import { resourceNodes } from './useResourceNodes'
import type { WorkflowGraph } from '#shared/types/graph'

const graph = {
  nodes: [
    { id: 'wf1', name: 'A', active: true, triggers: [], tags: [], webhookPaths: [],
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 }, deepLink: null },
    { id: 'wf2', name: 'B', active: true, triggers: [], tags: [], webhookPaths: [],
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 }, deepLink: null },
  ],
  edges: [], triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [],
  credentials: [
    { id: 'c1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['wf1', 'wf2'], source: 'inferred' as const },
    { id: null, name: 'NoId', type: 'slackApi', workflowIds: ['wf1'], source: 'inferred' as const },
  ],
  dataTables: [
    { id: 't1', name: 'Demo', projectId: 'p', workflowIds: ['wf1'], operations: ['insert'], source: 'inferred' as const },
    { id: 't2', name: 'Orphan', projectId: 'p', workflowIds: [], operations: [], source: 'api' as const },
  ],
  enrichment: { credentials: false, dataTables: false },
} as unknown as WorkflowGraph

const all = new Set(['wf1', 'wf2'])

describe('resourceNodes', () => {
  it('emits shared credential nodes with one edge per using-workflow when credentials on', () => {
    const r = resourceNodes(graph, { credentials: true, dataTables: false }, all)
    const shared = r.nodes.find(n => n.label === 'My API')!
    expect(shared).toMatchObject({ id: 'cred:httpHeaderAuth:c1', kind: 'credential', workflowIds: ['wf1', 'wf2'] })
    expect(r.edges.filter(e => e.target === 'cred:httpHeaderAuth:c1').map(e => e.source)).toEqual(['wf1', 'wf2'])
    expect(r.edges.every(e => e.kind === 'credential')).toBe(true)
  })

  it('uses name when credential id is null (matches panel selection id)', () => {
    const r = resourceNodes(graph, { credentials: true, dataTables: false }, all)
    expect(r.nodes.find(n => n.label === 'NoId')!.id).toBe('cred:slackApi:NoId')
  })

  it('emits data-table nodes only when dataTables on, edges directed workflow -> table', () => {
    const r = resourceNodes(graph, { credentials: false, dataTables: true }, all)
    expect(r.nodes.map(n => n.id)).toEqual(['datatable:t1'])
    expect(r.edges).toEqual([{ source: 'wf1', target: 'datatable:t1', kind: 'dataTable' }])
  })

  it('drops a resource whose using-workflows are all out of scope', () => {
    const r = resourceNodes(graph, { credentials: true, dataTables: true }, new Set(['wf2']))
    // My API still has wf2; NoId (wf1 only) and t1 (wf1 only) drop
    expect(r.nodes.map(n => n.id).sort()).toEqual(['cred:httpHeaderAuth:c1'])
    expect(r.edges).toEqual([{ source: 'wf2', target: 'cred:httpHeaderAuth:c1', kind: 'credential' }])
  })

  it('emits nothing when both flags off or graph null', () => {
    expect(resourceNodes(graph, { credentials: false, dataTables: false }, all)).toEqual({ nodes: [], edges: [] })
    expect(resourceNodes(null, { credentials: true, dataTables: true }, all)).toEqual({ nodes: [], edges: [] })
  })
})
