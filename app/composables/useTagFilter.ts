import type { WorkflowGraph, WorkflowNode } from '#shared/types/graph'
import { tagsMatch } from './useViewFilter'

export function allTags(graph: WorkflowGraph | null): string[] {
  if (!graph) return []
  return [...new Set(graph.nodes.flatMap(n => n.tags))].sort()
}

export function matchesTags(node: WorkflowNode, selected: string[]): boolean {
  return tagsMatch(node.tags, selected)
}
