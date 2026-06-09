import type { TriggerKind, WorkflowGraph } from '#shared/types/graph'

export function triggerNodeId(
  graph: WorkflowGraph | null,
  workflowId: string,
  kind: TriggerKind,
  label?: string,
): string | null {
  const trigs = graph?.triggerNodes.filter(t => t.workflowId === workflowId && t.kind === kind) ?? []
  return (label ? trigs.find(t => t.label === label) : undefined)?.id ?? trigs[0]?.id ?? null
}
