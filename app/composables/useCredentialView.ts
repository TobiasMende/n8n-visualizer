import type { WorkflowGraph } from '#shared/types/graph'
import { prettifyType } from '#shared/prettify'

export interface CredentialRow {
  id: string | null; name: string; type: string; displayType: string
  workflowCount: number; workflowIds: string[]
}

export function credentialRows(graph: WorkflowGraph | null): CredentialRow[] {
  if (!graph) return []
  return graph.credentials.map(c => ({
    id: c.id, name: c.name, type: c.type, displayType: prettifyType(c.type),
    workflowCount: c.workflowIds.length, workflowIds: c.workflowIds,
  }))
}

export function credentialWorkflows(
  graph: WorkflowGraph | null, id: string | null, type: string, name: string,
): { id: string; name: string }[] {
  if (!graph) return []
  const cred = graph.credentials.find(c => c.type === type && c.name === name && c.id === id)
  if (!cred) return []
  const nameById = new Map(graph.nodes.map(n => [n.id, n.name]))
  return cred.workflowIds
    .map(wfId => ({ id: wfId, name: nameById.get(wfId) ?? wfId }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
