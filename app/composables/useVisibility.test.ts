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
  it('returns app for app-triggered nodes', () => {
    expect(entryKindOf(node('x', ['app']))).toBe('app')
  })
  it('returns manual for manual-triggered nodes', () => {
    expect(entryKindOf(node('x', ['manual']))).toBe('manual')
  })
  it('returns none for unknown-only trigger', () => {
    expect(entryKindOf(node('x', ['unknown']))).toBe('none')
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
  it('combines hidden trigger kind and hideErrorHandlers', () => {
    const v = defaultVisibility(); v.triggerKinds.webhook = false; v.hideErrorHandlers = true
    const r = visibleGraph(graph, v)
    // hook (webhook) is hidden; handler is error-handler but also hidden by trigger; sub remains
    expect(r.nodes.map(n => n.id)).toEqual(['sub'])
    expect(r.edges).toHaveLength(0)
  })
  it('does not drop nodes with an unmapped/unknown trigger kind', () => {
    const unknownNode = node('unk', ['unknown' as any])
    const g: WorkflowGraph = { nodes: [unknownNode], edges: [], unresolved: [], skipped: [], webhooks: [], schedules: [], credentials: [] }
    const v = defaultVisibility()
    const r = visibleGraph(g, v)
    expect(r.nodes.map(n => n.id)).toEqual(['unk'])
  })
})
