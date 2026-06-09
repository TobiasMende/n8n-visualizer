import type { RawNode, CadenceGroup } from '#shared/types/graph'

export interface ParsedCadence { cadenceText: string; cadenceGroup: CadenceGroup; cronExpr: string | null }

const hhmm = (h: number, m: number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function parseRule(rule: any): ParsedCadence | null {
  const min = Number(rule?.triggerAtMinute ?? 0)
  const hour = Number(rule?.triggerAtHour ?? 0)
  switch (rule?.field) {
    case 'seconds': {
      const n = Number(rule.secondsInterval ?? 1)
      return { cadenceText: `Every ${n} second${n === 1 ? '' : 's'}`, cadenceGroup: 'sub-minute', cronExpr: null }
    }
    case 'minutes': {
      const n = Number(rule.minutesInterval ?? 1)
      return { cadenceText: `Every ${n} minute${n === 1 ? '' : 's'}`, cadenceGroup: 'minutes', cronExpr: `*/${n} * * * *` }
    }
    case 'hours': {
      const n = Number(rule.hoursInterval ?? 1)
      return { cadenceText: `Every ${n} hour${n === 1 ? '' : 's'} at :${String(min).padStart(2, '0')}`, cadenceGroup: 'hourly', cronExpr: n === 1 ? `${min} * * * *` : null }
    }
    case 'days': {
      const n = Number(rule.daysInterval ?? 1)
      const text = n === 1 ? `Every day at ${hhmm(hour, min)}` : `Every ${n} days at ${hhmm(hour, min)}`
      return { cadenceText: text, cadenceGroup: 'daily', cronExpr: n === 1 ? `${min} ${hour} * * *` : null }
    }
    case 'weeks': {
      const daysRaw = Array.isArray(rule.triggerAtDay) ? rule.triggerAtDay.map(Number) : []
      const days = daysRaw.length ? daysRaw : [0]
      const names = days.map(d => DOW[d] ?? `Day ${d}`).join(', ')
      return { cadenceText: `Weekly on ${names} at ${hhmm(hour, min)}`, cadenceGroup: 'weekly', cronExpr: `${min} ${hour} * * ${days.join(',')}` }
    }
    case 'months': {
      const dom = Number(rule.triggerAtDayOfMonth ?? 1)
      return { cadenceText: `Monthly on day ${dom} at ${hhmm(hour, min)}`, cadenceGroup: 'monthly', cronExpr: `${min} ${hour} ${dom} * *` }
    }
    case 'cronExpression': {
      const expr = String(rule.expression ?? '').trim()
      if (!expr) return null
      return { cadenceText: `Cron: ${expr}`, cadenceGroup: 'cron', cronExpr: expr }
    }
    default:
      return null
  }
}

export function parseSchedule(node: RawNode): ParsedCadence[] {
  if (node.type === 'n8n-nodes-base.scheduleTrigger') {
    const rules: any[] = node.parameters?.rule?.interval ?? []
    return rules.map(parseRule).filter((r): r is ParsedCadence => r !== null)
  }
  if (node.type === 'n8n-nodes-base.cron') {
    const expr = node.parameters?.cronExpression
    if (typeof expr === 'string' && expr.trim())
      return [{ cadenceText: `Cron: ${expr.trim()}`, cadenceGroup: 'cron', cronExpr: expr.trim() }]
    return []
  }
  return []
}
