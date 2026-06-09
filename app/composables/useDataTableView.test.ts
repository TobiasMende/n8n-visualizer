import { describe, it, expect } from 'vitest'
import { dataTableRows, dataTableWorkflows } from './useDataTableView'
import type { WorkflowGraph } from '#shared/types/graph'

const graph = {
  nodes: [
    { id: 'wf1', name: 'Alpha', active: true, triggers: [], tags: [], webhookPaths: [],
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 }, deepLink: null },
  ],
  edges: [], triggerNodes: [], unresolved: [], skipped: [], webhooks: [], schedules: [], credentials: [],
  dataTables: [
    { id: 'tbl1', name: 'Demo', projectId: 'p', workflowIds: ['wf1'], operations: ['insert', 'rowExists'], source: 'both' as const,
      columns: [{ name: 'name', type: 'string' }] },
    { id: 'tbl2', name: 'Orphan', projectId: 'p', workflowIds: [], operations: [], source: 'api' as const },
  ],
  enrichment: { credentials: false, dataTables: true },
} as unknown as WorkflowGraph

describe('dataTableRows', () => {
  it('maps tables to rows with workflow counts, columns and unused flag', () => {
    const rows = dataTableRows(graph)
    expect(rows).toEqual([
      { id: 'tbl1', name: 'Demo', projectId: 'p', workflowCount: 1, workflowIds: ['wf1'],
        operations: ['insert', 'rowExists'], columnCount: 1, source: 'both', unused: false },
      { id: 'tbl2', name: 'Orphan', projectId: 'p', workflowCount: 0, workflowIds: [],
        operations: [], columnCount: 0, source: 'api', unused: true },
    ])
  })
  it('returns [] for null graph', () => {
    expect(dataTableRows(null)).toEqual([])
  })
})

describe('dataTableWorkflows', () => {
  it('resolves workflow ids to names sorted alphabetically', () => {
    expect(dataTableWorkflows(graph, 'tbl1')).toEqual([{ id: 'wf1', name: 'Alpha' }])
  })
})
