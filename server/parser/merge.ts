import type { CredentialRef, DataTableRef } from '#shared/types/graph'
import type { ApiCredential, ApiDataTable } from '../ingest/n8n-client'

export function mergeCredentials(
  inferred: CredentialRef[], api: ApiCredential[] | null,
): CredentialRef[] {
  if (!api) return inferred
  const byId = new Map<string, CredentialRef>()
  const byTypeName = new Map<string, CredentialRef>()
  const out: CredentialRef[] = inferred.map(c => ({ ...c }))
  for (const c of out) {
    if (c.id) byId.set(c.id, c)
    byTypeName.set(`${c.type}:${c.name}`, c)
  }
  for (const a of api) {
    const match = (a.id && byId.get(a.id)) || byTypeName.get(`${a.type}:${a.name}`)
    if (match) {
      match.source = 'both'
      if (a.createdAt) match.createdAt = a.createdAt
      if (a.updatedAt) match.updatedAt = a.updatedAt
    } else {
      out.push({
        id: a.id ?? null, name: a.name, type: a.type, workflowIds: [], source: 'api',
        ...(a.createdAt ? { createdAt: a.createdAt } : {}),
        ...(a.updatedAt ? { updatedAt: a.updatedAt } : {}),
      })
    }
  }
  return out
}

export function mergeDataTables(
  inferred: DataTableRef[], api: ApiDataTable[] | null,
): DataTableRef[] {
  if (!api) return inferred
  const byId = new Map<string, DataTableRef>()
  const out: DataTableRef[] = inferred.map(t => ({ ...t }))
  for (const t of out) byId.set(t.id, t)
  for (const a of api) {
    const cols = a.columns?.map(c => ({ name: c.name, type: c.type }))
    const match = byId.get(a.id)
    if (match) {
      match.source = 'both'
      if (a.projectId != null) match.projectId = a.projectId
      if (cols) match.columns = cols
      if (a.createdAt) match.createdAt = a.createdAt
      if (a.updatedAt) match.updatedAt = a.updatedAt
    } else {
      out.push({
        id: a.id, name: a.name, projectId: a.projectId ?? null,
        workflowIds: [], operations: [], source: 'api',
        ...(cols ? { columns: cols } : {}),
        ...(a.createdAt ? { createdAt: a.createdAt } : {}),
        ...(a.updatedAt ? { updatedAt: a.updatedAt } : {}),
      })
    }
  }
  return out
}
