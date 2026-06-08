import type { RawWorkflow, WebhookEntry } from '#shared/types/graph'
import { webhookPathOf } from '../parser/webhook-path'

export function buildWebhooks(workflows: RawWorkflow[], baseUrl: string | null): WebhookEntry[] {
  const base = baseUrl ? baseUrl.replace(/\/+$/, '') : null
  const out: WebhookEntry[] = []
  for (const wf of workflows ?? []) {
    for (const node of wf.nodes ?? []) {
      const path = webhookPathOf(node)
      if (path === null) continue
      const method = typeof node.parameters?.httpMethod === 'string'
        ? node.parameters.httpMethod : 'GET'
      out.push({
        workflowId: wf.id,
        method,
        path,
        prodUrl: base ? `${base}/webhook/${path}` : null,
        testUrl: base ? `${base}/webhook-test/${path}` : null,
      })
    }
  }
  return out
}
