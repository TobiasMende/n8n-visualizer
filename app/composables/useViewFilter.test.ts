import { describe, it, expect } from 'vitest'
import { matchesQuery, tagsMatch } from './useViewFilter'

describe('matchesQuery', () => {
  it('matches case-insensitively and passes when query is blank', () => {
    expect(matchesQuery('Order Flow', 'order')).toBe(true)
    expect(matchesQuery('Order Flow', '  ')).toBe(true)
    expect(matchesQuery('Order Flow', 'zzz')).toBe(false)
  })
})

describe('tagsMatch', () => {
  it('passes when no tags selected, else needs an intersection', () => {
    expect(tagsMatch(['prod'], [])).toBe(true)
    expect(tagsMatch(['prod', 'eu'], ['eu'])).toBe(true)
    expect(tagsMatch(['prod'], ['eu'])).toBe(false)
    expect(tagsMatch([], ['eu'])).toBe(false)
  })
})
