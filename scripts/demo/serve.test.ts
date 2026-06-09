import { describe, it, expect } from 'vitest'
import { waitForServer } from './serve'

describe('waitForServer', () => {
  it('resolves once the probe returns ok', async () => {
    let calls = 0
    const probe = async () => { calls++; return calls >= 3 }
    await expect(waitForServer('http://x', { probe, intervalMs: 1, timeoutMs: 1000 })).resolves.toBe(true)
    expect(calls).toBe(3)
  })

  it('rejects after the timeout', async () => {
    const probe = async () => false
    await expect(waitForServer('http://x', { probe, intervalMs: 1, timeoutMs: 20 }))
      .rejects.toThrow(/not ready/i)
  })
})
