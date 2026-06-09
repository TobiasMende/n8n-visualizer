import type { TriggerKind, WorkflowGraph } from '#shared/types/graph'
import { prettifyType } from '#shared/prettify'

export interface ResourceLink { id: string; name: string; type: string }
export interface TriggerLink { id: string; label: string; kind: TriggerKind }

export interface WorkflowResources {
  credentials: ResourceLink[]
  dataTables: ResourceLink[]
  triggers: TriggerLink[]
}

export function workflowResources(graph: WorkflowGraph | null, workflowId: string): WorkflowResources {
  if (!graph) return { credentials: [], dataTables: [], triggers: [] }

  const credentials: ResourceLink[] = graph.credentials
    .filter(c => c.workflowIds.includes(workflowId))
    .map(c => ({ id: `cred:${c.type}:${c.id ?? c.name}`, name: c.name, type: prettifyType(c.type) }))

  const dataTables: ResourceLink[] = graph.dataTables
    .filter(t => t.workflowIds.includes(workflowId))
    .map(t => ({ id: `datatable:${t.id}`, name: t.name, type: 'data table' }))

  const triggers: TriggerLink[] = graph.triggerNodes
    .filter(t => t.workflowId === workflowId)
    .map(t => ({ id: t.id, label: t.label, kind: t.kind }))

  return { credentials, dataTables, triggers }
}
