import { describe, it, expect } from 'vitest'
import { extractDataTables } from './data-tables'
import type { RawWorkflow } from '#shared/types/graph'

const dtNode = (name: string, op: string | undefined, rl: Record<string, unknown>) => ({
  name, type: 'n8n-nodes-base.dataTable',
  parameters: { ...(op ? { operation: op } : {}), dataTableId: rl },
})
const listRl = {
  __rl: true, mode: 'list', value: 'tbl1', cachedResultName: 'Demo',
  cachedResultUrl: '/projects/projA/datatables/tbl1',
}

const a: RawWorkflow = { id: 'a', name: 'A', nodes: [dtNode('Insert row', undefined, listRl)] }
const b: RawWorkflow = { id: 'b', name: 'B', nodes: [dtNode('If row exists', 'rowExists', listRl)] }

describe('extractDataTables', () => {
  it('extracts id, name, projectId and defaults operation to insert', () => {
    const got = extractDataTables([a])
    expect(got).toEqual([{
      id: 'tbl1', name: 'Demo', projectId: 'projA',
      workflowIds: ['a'], operations: ['insert'], source: 'inferred',
    }])
  })

  it('dedupes a shared table across workflows and aggregates operations', () => {
    const got = extractDataTables([a, b])
    expect(got).toHaveLength(1)
    expect(got[0]).toMatchObject({
      id: 'tbl1', workflowIds: ['a', 'b'], operations: ['insert', 'rowExists'],
    })
  })

  it('falls back name to id when cachedResultName is missing', () => {
    const wf: RawWorkflow = { id: 'c', name: 'C', nodes: [
      dtNode('x', 'get', { __rl: true, mode: 'id', value: 'tbl9' }),
    ] }
    expect(extractDataTables([wf])[0]).toMatchObject({ id: 'tbl9', name: 'tbl9', projectId: null })
  })

  it('skips dynamic expression refs and missing values', () => {
    const wf: RawWorkflow = { id: 'd', name: 'D', nodes: [
      dtNode('expr', 'get', { __rl: true, mode: 'expression', value: '={{ $json.id }}' }),
      dtNode('empty', 'get', { __rl: true, mode: 'list', value: '' }),
      { name: 'plain', type: 'n8n-nodes-base.set', parameters: {} },
    ] }
    expect(extractDataTables([wf])).toEqual([])
  })
})
