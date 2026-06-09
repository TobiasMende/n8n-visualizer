import type { RawWorkflow, TriggerType, TriggerNode } from '#shared/types/graph'
import type { NodeCatalog } from '../catalog/catalog'
import { webhookNodeInfo } from '../webhooks/extract'
import { parseSchedule } from '../schedule/parse'

const SCHEDULE = new Set([
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.cron',
  'n8n-nodes-base.interval',
])

const EXECUTE_TRIGGER = 'n8n-nodes-base.executeWorkflowTrigger'

export function classifyTriggers(wf: RawWorkflow): TriggerType[] {
  const set = new Set<TriggerType>()
  for (const node of wf.nodes ?? []) {
    const t = node.type
    if (t === EXECUTE_TRIGGER) continue
    if (t === 'n8n-nodes-base.webhook') set.add('webhook')
    else if (SCHEDULE.has(t)) set.add('schedule')
    else if (t === 'n8n-nodes-base.manualTrigger') set.add('manual')
    else if (t.endsWith('Trigger')) set.add('app')
  }
  return [...set]
}

function push(out: TriggerNode[], wfId: string, name: string, i: number, kind: TriggerNode['kind'], label: string) {
  out.push({ id: `trig:${wfId}:${name}#${i}`, workflowId: wfId, kind, label })
}

export function extractTriggerNodes(wf: RawWorkflow, catalog: NodeCatalog): TriggerNode[] {
  const out: TriggerNode[] = []
  for (const node of wf.nodes ?? []) {
    const t = node.type
    if (t === EXECUTE_TRIGGER) continue

    if (t === 'n8n-nodes-base.formTrigger') {
      const info = webhookNodeInfo(node)
      push(out, wf.id, node.name, 0, 'form', info ? `Form /${info.path}` : 'Form')
    } else if (t === 'n8n-nodes-base.webhook') {
      const info = webhookNodeInfo(node)
      push(out, wf.id, node.name, 0, 'webhook', info ? `${info.method} /${info.path}` : 'Webhook')
    } else if (SCHEDULE.has(t)) {
      const cadences = parseSchedule(node)
      if (cadences.length === 0) push(out, wf.id, node.name, 0, 'schedule', catalog.displayName(t))
      else cadences.forEach((c, i) => push(out, wf.id, node.name, i, 'schedule', c.cadenceText))
    } else if (t === 'n8n-nodes-base.manualTrigger') {
      push(out, wf.id, node.name, 0, 'manual', 'Manual')
    } else if (t.endsWith('Trigger')) {
      push(out, wf.id, node.name, 0, 'app', catalog.displayName(t))
    }
  }
  return out
}
