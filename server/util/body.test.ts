import { describe, it, expect } from 'vitest'
import { Readable } from 'node:stream'
import type { H3Event } from 'h3'
import { readJsonBodyCapped } from './body'

function eventFrom(chunks: string[]): H3Event {
  const req = Readable.from(chunks.map(c => Buffer.from(c)))
  return { node: { req } } as unknown as H3Event
}

describe('readJsonBodyCapped', () => {
  it('parses a small JSON body', async () => {
    const body = await readJsonBodyCapped(eventFrom(['{"a":', '1}']), 1000)
    expect(body).toEqual({ a: 1 })
  })

  it('resolves null for an empty body', async () => {
    expect(await readJsonBodyCapped(eventFrom([]), 1000)).toBeNull()
  })

  it('rejects 413 when the streamed size exceeds the cap', async () => {
    const big = ['x'.repeat(600), 'y'.repeat(600)] // 1200 bytes, cap 1000
    await expect(readJsonBodyCapped(eventFrom(big), 1000))
      .rejects.toMatchObject({ statusCode: 413 })
  })

  it('caps regardless of a (missing) content-length — chunk-by-chunk', async () => {
    const chunks = Array.from({ length: 100 }, () => 'a'.repeat(50)) // 5000 bytes
    await expect(readJsonBodyCapped(eventFrom(chunks), 1000))
      .rejects.toMatchObject({ statusCode: 413 })
  })

  it('rejects 400 on invalid JSON', async () => {
    await expect(readJsonBodyCapped(eventFrom(['not json']), 1000))
      .rejects.toMatchObject({ statusCode: 400 })
  })
})
