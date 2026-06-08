import type { RawWorkflow } from '#shared/types/graph'

export function normalizeWorkflows(input: unknown): RawWorkflow[] {
  if (Array.isArray(input)) return input as RawWorkflow[]
  if (input && typeof input === 'object') {
    const obj = input as Record<string, any>
    if (Array.isArray(obj.data)) return obj.data as RawWorkflow[]
    if (Array.isArray(obj.workflows)) return obj.workflows as RawWorkflow[]
    if (typeof obj.id === 'string' || Array.isArray(obj.nodes)) return [obj as RawWorkflow]
  }
  return []
}
