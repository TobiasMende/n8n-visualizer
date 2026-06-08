import type { RawWorkflow, TriggerType } from '#shared/types/graph'

const SCHEDULE = new Set([
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.cron',
  'n8n-nodes-base.interval',
])

export function classifyTriggers(wf: RawWorkflow): TriggerType[] {
  const set = new Set<TriggerType>()
  for (const node of wf.nodes ?? []) {
    const t = node.type
    if (t === 'n8n-nodes-base.webhook') set.add('webhook')
    else if (SCHEDULE.has(t)) set.add('schedule')
    else if (t === 'n8n-nodes-base.manualTrigger') set.add('manual')
    else if (t.endsWith('Trigger')) set.add('app')
  }
  return [...set]
}
