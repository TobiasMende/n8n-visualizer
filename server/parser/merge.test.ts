import { describe, it, expect } from 'vitest'
import { mergeCredentials, mergeDataTables } from './merge'
import type { CredentialRef, DataTableRef } from '#shared/types/graph'
import type { ApiCredential, ApiDataTable } from '../ingest/n8n-client'

describe('mergeCredentials', () => {
  const inferred: CredentialRef[] = [
    { id: '1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['a'], source: 'inferred' },
  ]
  it('marks matched credentials as both and adds timestamps', () => {
    const api: ApiCredential[] = [{ id: '1', name: 'My API', type: 'httpHeaderAuth', createdAt: 'T1', updatedAt: 'T2' }]
    const got = mergeCredentials(inferred, api)
    expect(got).toContainEqual({ id: '1', name: 'My API', type: 'httpHeaderAuth', workflowIds: ['a'],
      source: 'both', createdAt: 'T1', updatedAt: 'T2' })
  })
  it('adds API-only credentials as orphans with empty workflowIds', () => {
    const api: ApiCredential[] = [
      { id: '1', name: 'My API', type: 'httpHeaderAuth' },
      { id: '9', name: 'Unused', type: 'slackApi' },
    ]
    const got = mergeCredentials(inferred, api)
    expect(got.find(c => c.id === '9')).toEqual({ id: '9', name: 'Unused', type: 'slackApi',
      workflowIds: [], source: 'api' })
  })
  it('returns inferred unchanged when api is null', () => {
    expect(mergeCredentials(inferred, null)).toEqual(inferred)
  })
})

describe('mergeDataTables', () => {
  const inferred: DataTableRef[] = [
    { id: 't1', name: 'Demo', projectId: 'p', workflowIds: ['a'], operations: ['insert'], source: 'inferred' },
  ]
  it('enriches matched tables with columns and timestamps and marks both', () => {
    const api: ApiDataTable[] = [{ id: 't1', name: 'Demo', projectId: 'p',
      columns: [{ id: 'c', name: 'name', type: 'string', index: 0 }], createdAt: 'T1', updatedAt: 'T2' }]
    const got = mergeDataTables(inferred, api)
    expect(got[0]).toEqual({ id: 't1', name: 'Demo', projectId: 'p', workflowIds: ['a'], operations: ['insert'],
      source: 'both', columns: [{ name: 'name', type: 'string' }], createdAt: 'T1', updatedAt: 'T2' })
  })
  it('adds API-only tables as orphans', () => {
    const api: ApiDataTable[] = [{ id: 't9', name: 'Orphan', projectId: 'q', columns: [] }]
    const got = mergeDataTables(inferred, api)
    expect(got.find(t => t.id === 't9')).toEqual({ id: 't9', name: 'Orphan', projectId: 'q',
      workflowIds: [], operations: [], source: 'api', columns: [] })
  })
  it('returns inferred unchanged when api is null', () => {
    expect(mergeDataTables(inferred, null)).toEqual(inferred)
  })
})
