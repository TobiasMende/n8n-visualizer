import type { WorkflowGraph, WorkflowNode } from '#shared/types/graph'

export function allTags(graph: WorkflowGraph | null): string[] {
  if (!graph) return []
  return [...new Set(graph.nodes.flatMap(n => n.tags))].sort()
}

export function matchesTags(node: WorkflowNode, selected: string[]): boolean {
  if (selected.length === 0) return true
  return node.tags.some(t => selected.includes(t))
}
