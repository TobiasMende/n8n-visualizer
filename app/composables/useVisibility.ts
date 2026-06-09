import type { WorkflowGraph, WorkflowNode, TriggerType } from '#shared/types/graph'

export type EntryKind = 'webhook' | 'schedule' | 'manual' | 'app' | 'none'

export interface Visibility {
  triggerKinds: Record<EntryKind, boolean>
  hideErrorHandlers: boolean
  linkTypes: Record<'execute' | 'webhookHttp' | 'error', boolean>
  overlays: { credentials: boolean; nodeTypes: boolean }
  hiddenNodeTypes: string[]
}

export function defaultVisibility(): Visibility {
  return {
    triggerKinds: { webhook: true, schedule: true, manual: true, app: true, none: true },
    hideErrorHandlers: false,
    linkTypes: { execute: true, webhookHttp: true, error: true },
    overlays: { credentials: false, nodeTypes: false },
    hiddenNodeTypes: [],
  }
}

const PRIORITY: TriggerType[] = ['webhook', 'schedule', 'app', 'manual']

export function entryKindOf(node: WorkflowNode): EntryKind {
  for (const k of PRIORITY) if (node.triggers.includes(k)) return k
  return 'none'
}

export function errorHandlerIds(graph: WorkflowGraph): Set<string> {
  const s = new Set<string>()
  for (const e of graph.edges) if (e.type === 'error') s.add(e.target)
  return s
}

export function visibleGraph(graph: WorkflowGraph, v: Visibility): {
  nodes: WorkflowNode[]; edges: WorkflowGraph['edges']
} {
  const handlers = errorHandlerIds(graph)
  const nodes = graph.nodes.filter(n => {
    const kind = entryKindOf(n)
    if (v.triggerKinds[kind] === false) return false
    if (v.hideErrorHandlers && handlers.has(n.id)) return false
    return true
  })
  const ids = new Set(nodes.map(n => n.id))
  const edges = graph.edges.filter(e =>
    v.linkTypes[e.type] && ids.has(e.source) && ids.has(e.target))
  return { nodes, edges }
}
