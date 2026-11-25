import { CronExpressionParser } from 'cron-parser'

export function nextFire(cronExpr: string | null, from: string, tz: string = 'UTC'): string | null {
  if (!cronExpr) return null
  try {
    const interval = CronExpressionParser.parse(cronExpr, { currentDate: new Date(from), tz })
    return interval.next().toDate().toISOString()
  } catch {
    return null
  }
}
