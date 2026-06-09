import { prettifyType } from '#shared/prettify'

export const WORKFLOW_NAMES = [
  'Order Sync', 'Lead Enrichment', 'Invoice Pipeline', 'Support Triage',
  'Daily Digest', 'Inventory Reconcile', 'Signup Onboarding', 'Churn Alert',
  'Payment Retry', 'Report Builder', 'Data Backfill', 'Webhook Relay',
  'Slack Notifier', 'CRM Updater', 'Email Campaign', 'Image Resizer',
]
export const CRED_NAMES = [
  'Acme API', 'Mailer SMTP', 'Warehouse DB', 'Billing OAuth',
  'Storage S3', 'Analytics Key', 'Chat Token', 'CRM Account',
]
export const TAG_NAMES = ['production', 'internal', 'finance', 'marketing', 'ops', 'experimental']
const SLUG = 'abcdefghijklmnopqrstuvwxyz0123456789'

function pick(pool: string[], i: number): string {
  return i < pool.length ? pool[i] : `${pool[i % pool.length]} ${Math.floor(i / pool.length) + 1}`
}

export class Faker {
  private wf = new Map<string, string>()
  private cred = new Map<string, string>()
  private tag = new Map<string, string>()
  private hook = new Map<string, string>()
  private hookId = new Map<string, string>()
  private nodeCounts = new Map<string, number>()

  private alloc(map: Map<string, string>, key: string, pool: string[]): string {
    const hit = map.get(key)
    if (hit) return hit
    const v = pick(pool, map.size)
    map.set(key, v)
    return v
  }

  workflowName(id: string): string { return this.alloc(this.wf, id, WORKFLOW_NAMES) }
  credName(key: string): string { return this.alloc(this.cred, key, CRED_NAMES) }
  tagName(key: string): string { return this.alloc(this.tag, key, TAG_NAMES) }

  nodeName(workflowId: string, type: string): string {
    const base = prettifyType(type)
    const k = `${workflowId}:${base}`
    const n = (this.nodeCounts.get(k) ?? 0) + 1
    this.nodeCounts.set(k, n)
    return n === 1 ? base : `${base} ${n}`
  }

  webhookPath(key: string): string {
    const hit = this.hook.get(key)
    if (hit) return hit
    const i = this.hook.size
    let slug = ''
    let x = i + 1
    for (let j = 0; j < 6; j++) { slug += SLUG[x % SLUG.length]; x = Math.floor(x / SLUG.length) + 7 }
    const v = `hook-${slug}`
    this.hook.set(key, v)
    return v
  }

  webhookId(key: string): string {
    const hit = this.hookId.get(key)
    if (hit) return hit
    const i = this.hookId.size + 1
    let x = i
    let hex = ''
    for (let j = 0; j < 32; j++) { hex += SLUG[x % SLUG.length]; x = Math.floor(x / SLUG.length) + 13 }
    const v = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
    this.hookId.set(key, v)
    return v
  }

  fakeUrl(original: string): string {
    try {
      const u = new URL(original)
      return `https://api.demo.example${u.pathname === '/' ? '' : u.pathname}`
    } catch {
      return 'https://api.demo.example'
    }
  }
}
