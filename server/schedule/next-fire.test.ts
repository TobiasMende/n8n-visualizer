import { describe, it, expect } from 'vitest'
import { nextFire } from './next-fire'

describe('nextFire', () => {
  const from = '2026-06-08T01:00:00.000Z'

  it('computes the next occurrence of a daily cron after `from`', () => {
    expect(nextFire('0 2 * * *', from)).toBe('2026-06-08T02:00:00.000Z')
  })

  it('rolls to the next day when the time has passed', () => {
    const after = '2026-06-08T03:00:00.000Z'
    expect(nextFire('0 2 * * *', after)).toBe('2026-06-09T02:00:00.000Z')
  })

  it('returns null for a null expression', () => {
    expect(nextFire(null, from)).toBeNull()
  })

  it('returns null for an invalid expression', () => {
    expect(nextFire('not a cron', from)).toBeNull()
  })
})
