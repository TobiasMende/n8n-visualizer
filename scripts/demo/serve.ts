import { spawn, type ChildProcess } from 'node:child_process'

interface WaitOpts {
  probe?: (url: string) => Promise<boolean>
  intervalMs?: number
  timeoutMs?: number
  now?: () => number
}

async function defaultProbe(url: string): Promise<boolean> {
  try { return (await fetch(url)).ok } catch { return false }
}

export async function waitForServer(url: string, opts: WaitOpts = {}): Promise<boolean> {
  const probe = opts.probe ?? defaultProbe
  const intervalMs = opts.intervalMs ?? 500
  const timeoutMs = opts.timeoutMs ?? 60_000
  const now = opts.now ?? (() => performance.now())
  const start = now()
  for (;;) {
    if (await probe(url)) return true
    if (now() - start > timeoutMs) throw new Error(`Server not ready at ${url} after ${timeoutMs}ms`)
    await new Promise(r => setTimeout(r, intervalMs))
  }
}

export interface RunningServer { url: string; stop: () => void; spawned: boolean }

export async function startServer(url = 'http://localhost:3000'): Promise<RunningServer> {
  if (await defaultProbe(url)) return { url, stop: () => {}, spawned: false }
  const child: ChildProcess = spawn('bun', ['run', 'dev'], {
    stdio: 'ignore', detached: true, env: { ...process.env, TMPDIR: '/tmp' },
  })
  await waitForServer(url, { timeoutMs: 120_000 })
  return {
    url,
    spawned: true,
    stop: () => { try { if (child.pid) process.kill(-child.pid) } catch { /* already gone */ } },
  }
}
