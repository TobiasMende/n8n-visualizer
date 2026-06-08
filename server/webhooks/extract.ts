import type { RawNode } from '#shared/types/graph'

const WEBHOOK_TYPES = new Set(['n8n-nodes-base.webhook', 'n8n-nodes-base.formTrigger'])

export interface WebhookNodeInfo { path: string; method: string }

export function webhookNodeInfo(node: RawNode): WebhookNodeInfo | null {
  if (!WEBHOOK_TYPES.has(node.type)) return null
  const p = node.parameters ?? {}
  let path = typeof p.path === 'string' ? p.path.replace(/^\/+|\/+$/g, '') : ''
  if (!path && typeof node.webhookId === 'string' && node.webhookId) path = node.webhookId
  if (!path) return null
  const raw = p.httpMethod ?? p.options?.httpMethod
  const method = Array.isArray(raw)
    ? raw.join(',')
    : (typeof raw === 'string' && raw ? raw : 'GET')
  return { path, method }
}
