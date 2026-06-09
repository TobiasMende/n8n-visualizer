import { describe, it, expect } from 'vitest'
import { ffmpegArgs } from './encode'

describe('ffmpegArgs', () => {
  it('builds web-friendly h264 args', () => {
    const args = ffmpegArgs('in.webm', 'out.mp4')
    expect(args).toContain('-i')
    expect(args).toContain('in.webm')
    expect(args).toContain('out.mp4')
    expect(args).toContain('libx264')
    expect(args).toContain('+faststart')
    expect(args).toContain('yuv420p')
  })
})
