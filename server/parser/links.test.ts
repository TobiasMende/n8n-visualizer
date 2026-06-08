import { describe, it, expect } from 'vitest'
import { extractExecuteLinks, extractErrorLink } from './links'
import type { RawWorkflow } from '#shared/types/graph'

describe('extractExecuteLinks', () => {
  it('reads target id from a string workflowId param', () => {
    const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [
      { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: 'b' } },
    ] }
    expect(extractExecuteLinks(wf)).toEqual([{ source: 'a', target: 'b', type: 'execute' }])
  })

  it('reads target id from a resource-locator object param', () => {
    const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [
      { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: { value: 'c', mode: 'list' } } },
    ] }
    expect(extractExecuteLinks(wf)).toEqual([{ source: 'a', target: 'c', type: 'execute' }])
  })

  it('ignores execute nodes with no resolvable target', () => {
    const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [
      { name: 'call', type: 'n8n-nodes-base.executeWorkflow', parameters: { workflowId: { value: '', mode: 'list' } } },
    ] }
    expect(extractExecuteLinks(wf)).toEqual([])
  })
})

describe('extractErrorLink', () => {
  it('builds an edge from settings.errorWorkflow', () => {
    const wf: RawWorkflow = { id: 'a', name: 'A', nodes: [], settings: { errorWorkflow: 'eh' } }
    expect(extractErrorLink(wf)).toEqual({ source: 'a', target: 'eh', type: 'error' })
  })

  it('returns null when no error workflow is set', () => {
    expect(extractErrorLink({ id: 'a', name: 'A', nodes: [] })).toBeNull()
  })
})
