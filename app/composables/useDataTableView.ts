import type { WorkflowGraph } from '#shared/types/graph'
import { workflowNameMap } from './useGraphLookup'

export interface DataTableRow {
  id: string; name: string; projectId: string | null
  workflowCount: number; workflowIds: string[]
  operations: string[]; columnCount: number
  source: 'api' | 'inferred' | 'both'; unused: boolean
}

export function dataTableRows(graph: WorkflowGraph | null): DataTableRow[] {
  if (!graph) return []
  return graph.dataTables.map(t => ({
    id: t.id, name: t.name, projectId: t.projectId,
    workflowCount: t.workflowIds.length, workflowIds: t.workflowIds,
    operations: t.operations, columnCount: t.columns?.length ?? 0,
    source: t.source, unused: t.workflowIds.length === 0,
  }))
}

export function dataTableWorkflows(
  graph: WorkflowGraph | null, id: string,
): { id: string; name: string }[] {
  if (!graph) return []
  const table = graph.dataTables.find(t => t.id === id)
  if (!table) return []
  const nameById = workflowNameMap(graph)
  return table.workflowIds
    .map(wfId => ({ id: wfId, name: nameById.get(wfId) ?? wfId }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
