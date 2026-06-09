import { describe, it, expect } from 'vitest'
import { scheduleGroups, formatCountdown } from './useScheduleView'
import type { WorkflowGraph } from '#shared/types/graph'

const graph: WorkflowGraph = {
  nodes: [
    { id: 'a', name: 'Nightly', active: true, triggers: ['schedule'], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 } },
    { id: 'b', name: 'Poller', active: true, triggers: ['schedule'], tags: [], webhookPaths: [], deepLink: null,
      summary: { nodeCount: 0, nodeTypes: [], credentials: [], inbound: 0, outbound: 0 } },
  ],
  edges: [], unresolved: [], skipped: [], webhooks: [], credentials: [],
  schedules: [
    { workflowId: 'a', cadenceText: 'Every day at 02:00', cadenceGroup: 'daily', nextFire: '2026-06-09T02:00:00.000Z' },
    { workflowId: 'b', cadenceText: 'Every 15 minutes', cadenceGroup: 'minutes', nextFire: '2026-06-08T02:15:00.000Z' },
  ],
}

describe('scheduleGroups', () => {
  it('orders groups coarse-to-fine and joins workflow names', () => {
    const groups = scheduleGroups(graph)
    expect(groups.map(g => g.group)).toEqual(['minutes', 'daily'])
    expect(groups[0].rows[0]).toMatchObject({ workflow: 'Poller', cadenceText: 'Every 15 minutes' })
  })
})

describe('formatCountdown', () => {
  it('formats a positive delta', () => {
    expect(formatCountdown('2026-06-08T02:15:00.000Z', '2026-06-08T02:00:00.000Z')).toBe('in 15m')
  })
  it('handles null nextFire', () => {
    expect(formatCountdown(null, '2026-06-08T02:00:00.000Z')).toBe('—')
  })
  it('returns due when nextFire is in the past', () => {
    expect(formatCountdown('2026-06-08T01:00:00.000Z', '2026-06-08T02:00:00.000Z')).toBe('due')
  })
  it('formats hours branch correctly', () => {
    // 90 mins delta: hrs=1, mins%60=30 → "in 1h 30m"
    expect(formatCountdown('2026-06-08T03:30:00.000Z', '2026-06-08T02:00:00.000Z')).toBe('in 1h 30m')
  })
  it('formats days branch correctly', () => {
    // 25h delta: hrs=25, floor(hrs/24)=1, hrs%24=1 → "in 1d 1h"
    expect(formatCountdown('2026-06-09T03:00:00.000Z', '2026-06-08T02:00:00.000Z')).toBe('in 1d 1h')
  })
})
