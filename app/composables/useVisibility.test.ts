import { describe, it, expect } from 'vitest'
import { defaultVisibility, visibleGraph } from './useVisibility'
import type { WorkflowGraph, WorkflowNode, TriggerNode } from '#shared/types/graph'

const node = (id: string): WorkflowNode => ({
  id, name: id, active: true, triggers: [], tags: [], webhookPaths: [], deepLink: null,
  summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 },
})

const trig = (id: string, workflowId: string, kind: TriggerNode['kind']): TriggerNode =>
  ({ id, workflowId, kind, label: kind })

const graph: WorkflowGraph = {
  nodes: [node('hook'), node('sub'), node('handler')],
  edges: [
    { source: 'hook', target: 'sub', type: 'execute' },
    { source: 'hook', target: 'handler', type: 'error' },
  ],
  triggerNodes: [trig('t1', 'hook', 'webhook'), trig('t2', 'sub', 'schedule')],
  unresolved: [], skipped: [], webhooks: [], schedules: [], credentials: [],
}

describe('visibleGraph', () => {
  it('shows all workflows, edges and trigger nodes by default', () => {
    const r = visibleGraph(graph, defaultVisibility())
    expect(r.nodes.map(n => n.id).sort()).toEqual(['handler', 'hook', 'sub'])
    expect(r.edges).toHaveLength(2)
    expect(r.triggerNodes.map(t => t.id).sort()).toEqual(['t1', 't2'])
  })

  it('hides trigger nodes of a disabled kind but keeps the workflow', () => {
    const v = defaultVisibility(); v.triggerKinds.webhook = false
    const r = visibleGraph(graph, v)
    expect(r.nodes.map(n => n.id).sort()).toEqual(['handler', 'hook', 'sub'])
    expect(r.triggerNodes.map(t => t.id)).toEqual(['t2'])
  })

  it('drops trigger nodes whose target workflow is hidden', () => {
    const v = defaultVisibility(); v.hideErrorHandlers = true
    const g: WorkflowGraph = { ...graph, triggerNodes: [trig('t3', 'handler', 'webhook')] }
    const r = visibleGraph(g, v)
    expect(r.nodes.map(n => n.id).sort()).toEqual(['hook', 'sub'])
    expect(r.triggerNodes).toHaveLength(0)
  })

  it('hides error-handler workflows and error edges when hideErrorHandlers', () => {
    const v = defaultVisibility(); v.hideErrorHandlers = true
    const r = visibleGraph(graph, v)
    expect(r.nodes.map(n => n.id).sort()).toEqual(['hook', 'sub'])
    expect(r.edges.map(e => e.type)).toEqual(['execute'])
  })

  it('filters edges by link type', () => {
    const v = defaultVisibility(); v.linkTypes.error = false
    const r = visibleGraph(graph, v)
    expect(r.edges.map(e => e.type)).toEqual(['execute'])
  })
})

describe('defaultVisibility resources', () => {
  it('defaults data tables on, credentials off, node-types overlay off', () => {
    const d = defaultVisibility()
    expect(d.resources).toEqual({ credentials: false, dataTables: true })
    expect(d.overlays).toEqual({ nodeTypes: false })
  })
})
