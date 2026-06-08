import type { RawNode } from '#shared/types/graph'
import { webhookNodeInfo } from '../webhooks/extract'

export function webhookPathOf(node: RawNode): string | null {
  return webhookNodeInfo(node)?.path ?? null
}
