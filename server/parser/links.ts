import type { RawWorkflow, WorkflowEdge } from '#shared/types/graph'

function resolveWorkflowId(param: unknown): string | null {
  if (typeof param === 'string') return param || null
  if (param && typeof param === 'object' && 'value' in (param as object)) {
    const v = (param as Record<string, unknown>).value
    return typeof v === 'string' && v ? v : null
  }
  return null
}

export function extractExecuteLinks(wf: RawWorkflow): WorkflowEdge[] {
  const edges: WorkflowEdge[] = []
  for (const node of wf.nodes ?? []) {
    if (node.type !== 'n8n-nodes-base.executeWorkflow') continue
    const target = resolveWorkflowId(node.parameters?.workflowId)
    if (target) edges.push({ source: wf.id, target, type: 'execute' })
  }
  return edges
}

export function extractErrorLink(wf: RawWorkflow): WorkflowEdge | null {
  const target = wf.settings?.errorWorkflow
  return target ? { source: wf.id, target, type: 'error' } : null
}
