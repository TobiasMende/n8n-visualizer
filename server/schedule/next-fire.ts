import cronParser from 'cron-parser'

export function nextFire(cronExpr: string | null, from: string, tz: string = 'UTC'): string | null {
  if (!cronExpr) return null
  try {
    const interval = cronParser.parseExpression(cronExpr, { currentDate: new Date(from), tz })
    return interval.next().toDate().toISOString()
  } catch {
    return null
  }
}
