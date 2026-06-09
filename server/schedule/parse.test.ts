import { describe, it, expect } from 'vitest'
import { parseSchedule } from './parse'
import type { RawNode } from '#shared/types/graph'

const sched = (rule: any): RawNode =>
  ({ name: 's', type: 'n8n-nodes-base.scheduleTrigger', parameters: { rule } })

describe('parseSchedule', () => {
  it('parses a minutes interval', () => {
    const got = parseSchedule(sched({ interval: [{ field: 'minutes', minutesInterval: 15 }] }))
    expect(got).toEqual([{ cadenceText: 'Every 15 minutes', cadenceGroup: 'minutes', cronExpr: '*/15 * * * *' }])
  })

  it('parses a daily time', () => {
    const got = parseSchedule(sched({ interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 2, triggerAtMinute: 0 }] }))
    expect(got).toEqual([{ cadenceText: 'Every day at 02:00', cadenceGroup: 'daily', cronExpr: '0 2 * * *' }])
  })

  it('parses an explicit cron expression', () => {
    const got = parseSchedule(sched({ interval: [{ field: 'cronExpression', expression: '0 9 * * 1' }] }))
    expect(got).toEqual([{ cadenceText: 'Cron: 0 9 * * 1', cadenceGroup: 'cron', cronExpr: '0 9 * * 1' }])
  })

  it('parses seconds as sub-minute with no cron', () => {
    const got = parseSchedule(sched({ interval: [{ field: 'seconds', secondsInterval: 30 }] }))
    expect(got).toEqual([{ cadenceText: 'Every 30 seconds', cadenceGroup: 'sub-minute', cronExpr: null }])
  })

  it('returns [] for a non-schedule node', () => {
    expect(parseSchedule({ name: 'x', type: 'n8n-nodes-base.set' })).toEqual([])
  })

  it('hours interval 1 produces a cron expression', () => {
    const got = parseSchedule(sched({ interval: [{ field: 'hours', hoursInterval: 1, triggerAtMinute: 30 }] }))
    expect(got).toEqual([{ cadenceText: 'Every 1 hour at :30', cadenceGroup: 'hourly', cronExpr: '30 * * * *' }])
  })

  it('hours interval > 1 yields cronExpr null (*/N is not "every N hours from anchor")', () => {
    const got = parseSchedule(sched({ interval: [{ field: 'hours', hoursInterval: 2, triggerAtMinute: 15 }] }))
    expect(got[0].cronExpr).toBeNull()
    expect(got[0].cadenceGroup).toBe('hourly')
    expect(got[0].cadenceText).toBeTruthy()
  })

  it('days interval > 1 yields cronExpr null', () => {
    const got = parseSchedule(sched({ interval: [{ field: 'days', daysInterval: 3, triggerAtHour: 8, triggerAtMinute: 0 }] }))
    expect(got[0].cronExpr).toBeNull()
    expect(got[0].cadenceGroup).toBe('daily')
    expect(got[0].cadenceText).toBeTruthy()
  })

  it('weeks with empty triggerAtDay falls back to Sunday (day 0)', () => {
    const got = parseSchedule(sched({ interval: [{ field: 'weeks', triggerAtDay: [], triggerAtHour: 9, triggerAtMinute: 0 }] }))
    expect(got[0].cronExpr).toBe('0 9 * * 0')
    expect(got[0].cadenceText).toContain('Sunday')
  })
})
