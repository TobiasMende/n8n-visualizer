import { describe, it, expect } from 'vitest'
import { defaultVisibility, entryKindOf, visibleGraph } from './useVisibility'
import type { WorkflowGraph, WorkflowNode } from '#shared/types/graph'

const node = (id: string, triggers: any[] = []): WorkflowNode => ({
  id, name: id, active: true, triggers, tags: [], webhookPaths: [], deepLink: null,
  summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 },
})

const graph: WorkflowGraph = {
  nodes: [node('hook', ['webhook']), node('sub'), node('handler')],
  edges: [
    { source: 'hook', target: 'sub', type: 'execute' },
    { source: 'hook', target: 'handler', type: 'error' },
  ],
  unresolved: [], skipped: [], webhooks: [], schedules: [], credentials: [],
}

describe('entryKindOf', () => {
  it('returns the workflow entry kind, none for sub-workflows', () => {
    expect(entryKindOf(node('x', ['webhook']))).toBe('webhook')
    expect(entryKindOf(node('x', ['manual', 'schedule']))).toBe('schedule')
    expect(entryKindOf(node('x', []))).toBe('none')
  })
})

describe('visibleGraph', () => {
  it('shows everything with default visibility', () => {
    const r = visibleGraph(graph, defaultVisibility())
    expect(r.nodes.map(n => n.id).sort()).toEqual(['handler', 'hook', 'sub'])
    expect(r.edges).toHaveLength(2)
  })
  it('hides workflows of a hidden trigger kind and prunes their edges', () => {
    const v = defaultVisibility(); v.triggerKinds.webhook = false
    const r = visibleGraph(graph, v)
    expect(r.nodes.map(n => n.id).sort()).toEqual(['handler', 'sub'])
    expect(r.edges).toHaveLength(0)
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
