import type { WorkflowGraph, WorkflowNode, TriggerNode, TriggerKind } from '#shared/types/graph'

export interface Visibility {
  triggerKinds: Record<TriggerKind, boolean>
  hideErrorHandlers: boolean
  linkTypes: Record<'execute' | 'webhookHttp' | 'error', boolean>
  resources: { credentials: boolean; dataTables: boolean }
  overlays: { nodeTypes: boolean }
  hiddenNodeTypes: string[]
}

export function defaultVisibility(): Visibility {
  return {
    triggerKinds: { webhook: true, schedule: true, manual: true, app: true, form: true },
    hideErrorHandlers: false,
    linkTypes: { execute: true, webhookHttp: true, error: true },
    resources: { credentials: false, dataTables: true },
    overlays: { nodeTypes: false },
    hiddenNodeTypes: [],
  }
}

export function errorHandlerIds(graph: WorkflowGraph): Set<string> {
  const s = new Set<string>()
  for (const e of graph.edges) if (e.type === 'error') s.add(e.target)
  return s
}

export function visibleGraph(graph: WorkflowGraph, v: Visibility): {
  nodes: WorkflowNode[]; edges: WorkflowGraph['edges']; triggerNodes: TriggerNode[]
} {
  const handlers = errorHandlerIds(graph)
  const nodes = graph.nodes.filter(n => {
    if (v.hideErrorHandlers && handlers.has(n.id)) return false
    return true
  })
  const ids = new Set(nodes.map(n => n.id))
  const edges = graph.edges.filter(e =>
    v.linkTypes[e.type as keyof typeof v.linkTypes] && ids.has(e.source) && ids.has(e.target))
  const triggerNodes = graph.triggerNodes.filter(t =>
    v.triggerKinds[t.kind] !== false && ids.has(t.workflowId))
  return { nodes, edges, triggerNodes }
}
