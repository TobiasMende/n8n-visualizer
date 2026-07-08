import type { RawWorkflow, DataTableRef } from '#shared/types/graph'

const PROJECT_RE = /\/projects\/([^/]+)\/datatables\//

function parseRef(param: unknown): { id: string; name: string; projectId: string | null } | null {
  if (!param || typeof param !== 'object') return null
  const p = param as { mode?: unknown; value?: unknown; cachedResultName?: unknown; cachedResultUrl?: unknown }
  if (p.mode === 'expression') return null
  const value = p.value
  if (typeof value !== 'string' || value === '' || value.startsWith('=')) return null
  const name = typeof p.cachedResultName === 'string' && p.cachedResultName ? p.cachedResultName : value
  const url = typeof p.cachedResultUrl === 'string' ? p.cachedResultUrl : ''
  const projectId = PROJECT_RE.exec(url)?.[1] ?? null
  return { id: value, name, projectId }
}

export function extractDataTables(workflows: RawWorkflow[]): DataTableRef[] {
  const byId = new Map<string, DataTableRef>()
  for (const wf of workflows ?? []) {
    for (const node of wf.nodes ?? []) {
      if (node.type !== 'n8n-nodes-base.dataTable') continue
      const ref = parseRef(node.parameters?.dataTableId)
      if (!ref) continue
      const op = typeof node.parameters?.operation === 'string' ? node.parameters.operation : 'insert'
      const existing = byId.get(ref.id)
      if (existing) {
        if (!existing.workflowIds.includes(wf.id)) existing.workflowIds.push(wf.id)
        if (!existing.operations.includes(op)) existing.operations.push(op)
      } else {
        byId.set(ref.id, {
          id: ref.id, name: ref.name, projectId: ref.projectId,
          workflowIds: [wf.id], operations: [op], source: 'inferred',
        })
      }
    }
  }
  return [...byId.values()]
}
