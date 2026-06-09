import { mkdtempSync, rmSync, writeFileSync, mkdirSync, readdirSync, renameSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium, type Browser } from 'playwright'
import { fetchAllWorkflows, fetchAllCredentials, fetchAllDataTables, type FetchImpl } from '../../server/ingest/n8n-client'
import { safeFetch, type SafeFetchOptions } from '../../server/ingest/safe-fetch'
import { anonymizeBundle, assertBundleNoLeak } from './anonymize'
import { startServer } from './serve'
import { runTour } from './tour'
import { encodeToMp4, hasFfmpeg } from './encode'
import { promptCreds } from './prompt'

const OUT_DIR = join(import.meta.dirname, 'out')
const keep = process.argv.includes('--keep')

async function main() {
  const { baseUrl, apiKey, allowLocal } = await promptCreds(process.argv.slice(2))

  console.log('Fetching workflows…')
  const localFetch: FetchImpl = async (url, opts: SafeFetchOptions = {}) => {
    const res = await fetch(url, { headers: opts.headers, signal: opts.signal })
    return { status: res.status, ok: res.ok, headers: res.headers, text: () => res.text(), json: () => res.json() }
  }
  const fetchImpl = allowLocal ? localFetch : safeFetch
  // Credentials and data tables come from separate endpoints and are best-effort
  // (null if the key lacks scope or the n8n version is older).
  const [raw, credentials, dataTables] = await Promise.all([
    fetchAllWorkflows(baseUrl, apiKey, fetchImpl),
    fetchAllCredentials(baseUrl, apiKey, fetchImpl),
    fetchAllDataTables(baseUrl, apiKey, fetchImpl),
  ])
  console.log(`Fetched ${raw.length} workflows, ${credentials?.length ?? 0} credentials, ${dataTables?.length ?? 0} data tables. Anonymizing…`)

  const original = { workflows: raw, credentials, dataTables }
  const anon = anonymizeBundle(original)
  assertBundleNoLeak(original, anon)
  console.log('Anonymization verified (no leaks).')

  const tmp = mkdtempSync(join(tmpdir(), 'n8nviz-demo-'))
  const jsonPath = join(tmp, 'workflows.json')
  writeFileSync(jsonPath, JSON.stringify({
    workflows: anon.workflows,
    baseUrl: 'https://n8n.demo.example',
    apiCredentials: anon.credentials,
    apiDataTables: anon.dataTables,
  }))

  mkdirSync(OUT_DIR, { recursive: true })
  const server = await startServer()
  console.log(`App ready at ${server.url} (spawned: ${server.spawned})`)

  let browser: Browser | null = null
  let webm: string | null = null
  try {
    browser = await chromium.launch()
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: tmp, size: { width: 1280, height: 720 } },
    })
    const page = await context.newPage()
    try {
      await runTour(page, jsonPath)
    } finally {
      await context.close() // flushes the video file
    }

    const vids = readdirSync(tmp).filter(f => f.endsWith('.webm'))
    webm = vids.length ? join(tmp, vids[0]) : null

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    if (webm) {
      const mp4 = join(OUT_DIR, `n8nviz-demo-${stamp}.mp4`)
      if (hasFfmpeg()) {
        encodeToMp4(webm, mp4)
        console.log(`\n✅ MP4 written: ${mp4}`)
      } else {
        const keptWebm = join(OUT_DIR, `n8nviz-demo-${stamp}.webm`)
        renameSync(webm, keptWebm)
        console.log(`\n⚠️  ffmpeg missing — kept WebM: ${keptWebm} (brew install ffmpeg to get MP4)`)
      }
    } else {
      console.error('No video was recorded.')
    }
  } finally {
    if (browser) await browser.close()
    server.stop()
    if (!keep) rmSync(tmp, { recursive: true, force: true })
  }
}

main().catch(err => { console.error('\n❌', err.message); process.exit(1) })
