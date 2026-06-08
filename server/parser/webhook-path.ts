import type { RawNode } from '#shared/types/graph'

export function webhookPathOf(node: RawNode): string | null {
  if (node.type !== 'n8n-nodes-base.webhook') return null
  const p = node.parameters?.path
  return typeof p === 'string' && p ? p.replace(/^\/+|\/+$/g, '') : null
}
