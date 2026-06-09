import { describe, test, expect } from 'vitest'
import { createMemoryStore } from './memory-store'

describe('createMemoryStore', () => {
  test('counts increments per key', async () => {
    const store = createMemoryStore(() => 0)
    expect(await store.increment('a', 1000)).toBe(1)
    expect(await store.increment('a', 1000)).toBe(2)
    expect(await store.increment('b', 1000)).toBe(1)
  })

  test('drops entries after their ttl expires', async () => {
    let now = 0
    const store = createMemoryStore(() => now)
    await store.increment('a', 1000)
    now = 1001
    expect(await store.increment('a', 1000)).toBe(1)
  })

  test('does not grow unboundedly — expired keys are swept', async () => {
    let now = 0
    const store = createMemoryStore(() => now)
    await store.increment('old', 1000)
    now = 2000
    await store.increment('new', 1000)
    expect(store.size()).toBe(1)
  })
})
