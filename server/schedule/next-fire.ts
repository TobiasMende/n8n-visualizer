import cronParser from 'cron-parser'

export function nextFire(cronExpr: string | null, from: string): string | null {
  if (!cronExpr) return null
  try {
    const interval = cronParser.parseExpression(cronExpr, {
      currentDate: new Date(from),
      tz: 'UTC',
    })
    return interval.next().toDate().toISOString()
  } catch {
    return null
  }
}
