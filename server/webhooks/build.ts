import type { RawWorkflow, WebhookEntry } from '#shared/types/graph'
import { webhookNodeInfo } from './extract'

export function buildWebhooks(workflows: RawWorkflow[], baseUrl: string | null): WebhookEntry[] {
  const base = baseUrl ? baseUrl.replace(/\/+$/, '') : null
  const out: WebhookEntry[] = []
  for (const wf of workflows ?? []) {
    for (const node of wf.nodes ?? []) {
      const info = webhookNodeInfo(node)
      if (!info) continue
      out.push({
        workflowId: wf.id,
        method: info.method,
        path: info.path,
        prodUrl: base ? `${base}/webhook/${info.path}` : null,
        testUrl: base ? `${base}/webhook-test/${info.path}` : null,
      })
    }
  }
  return out
}
