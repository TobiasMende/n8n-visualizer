import { spawnSync } from 'node:child_process'

export function ffmpegArgs(input: string, output: string): string[] {
  return [
    '-y', '-i', input,
    '-movflags', '+faststart',
    '-pix_fmt', 'yuv420p',
    '-c:v', 'libx264', '-crf', '20',
    output,
  ]
}

export function hasFfmpeg(): boolean {
  return spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
}

export function encodeToMp4(input: string, output: string): void {
  if (!hasFfmpeg())
    throw new Error('ffmpeg not found. Install it (macOS: brew install ffmpeg). Keeping WebM.')
  const res = spawnSync('ffmpeg', ffmpegArgs(input, output), { stdio: 'inherit' })
  if (res.status !== 0) throw new Error(`ffmpeg exited with code ${res.status}`)
}
