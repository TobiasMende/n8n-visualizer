import type { Page } from 'playwright'

const FAKE_HOST = 'https://n8n.demo.example'
const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function runTour(page: Page, jsonPath: string): Promise<void> {
  // 1. Load app
  await page.goto('http://localhost:3000')
  await page.waitForSelector('.toolbar', { timeout: 30_000 })
  await pause(1000)

  // 2. Upload anonymized JSON via the real Upload-JSON flow
  await page.fill('input[placeholder="instance URL (optional, for links)"]', FAKE_HOST)
  await page.setInputFiles('input[type="file"]', jsonPath)
  await page.waitForSelector('.vue-flow__node', { timeout: 30_000 })
  await pause(1500)

  // 3. Map: fit the whole graph in frame, then select a workflow via the search
  // box. Selecting by clicking a graph node is unreliable on a large
  // auto-laid-out instance (nodes fall outside the viewport), whereas search
  // selection is position-independent and still opens the side panel and
  // triggers the trace-flow highlight (both driven by the selected id).
  await page.click('button[aria-label="Fit view"]')
  await pause(1500)
  await page.fill('input[placeholder="Search workflows / webhooks…"]', 'e')
  await pause(900)
  const result = page.locator('.search .results li').first()
  if (await result.count()) { await result.click(); await pause(2500) }
  // Zoom in for visual interest, then fit again.
  await page.click('button[aria-label="Zoom in"]')
  await page.click('button[aria-label="Zoom in"]')
  await pause(1200)
  await page.click('button[aria-label="Fit view"]')
  await pause(1200)

  // 4. Webhooks
  await page.click('nav.rail button[title="Webhooks"]')
  await pause(3000)

  // 5. Schedules
  await page.click('nav.rail button[title="Schedules"]')
  await pause(3000)

  // 6. Credentials (+ click first credential row if present)
  await page.click('nav.rail button[title="Credentials"]')
  await pause(1500)
  const cred = page.locator('table tbody tr, [role="row"]').first()
  if (await cred.count()) { await cred.click().catch(() => {}); await pause(2500) }

  // 7. Back to map beauty shot
  await page.click('nav.rail button[title="Map"]')
  await page.click('button[aria-label="Fit view"]')
  await pause(2000)
}
