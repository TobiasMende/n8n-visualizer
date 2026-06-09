import type { WorkflowGraph } from '#shared/types/graph'

export function workflowNameMap(graph: WorkflowGraph | null): Map<string, string> {
  return new Map((graph?.nodes ?? []).map(n => [n.id, n.name]))
}
