import type { RawWorkflow, CredentialRef } from '#shared/types/graph'

export function extractCredentials(workflows: RawWorkflow[]): CredentialRef[] {
  const byKey = new Map<string, CredentialRef>()
  for (const wf of workflows ?? []) {
    for (const node of wf.nodes ?? []) {
      for (const [type, cred] of Object.entries(node.credentials ?? {})) {
        if (!cred?.name) continue
        const key = `${type}:${cred.id ?? cred.name}`
        const existing = byKey.get(key)
        if (existing) {
          if (!existing.workflowIds.includes(wf.id)) existing.workflowIds.push(wf.id)
        } else {
          byKey.set(key, { id: cred.id ?? null, name: cred.name, type, workflowIds: [wf.id], source: 'inferred' })
        }
      }
    }
  }
  return [...byKey.values()]
}
