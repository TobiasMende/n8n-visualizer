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

  // 3. Map + the trace-flow "magic": fit the whole graph, then select a workflow
  // via search. Selecting by clicking a graph node is unreliable on a large
  // auto-laid-out instance (nodes fall outside the viewport); search selection
  // is position-independent and drives the same effect — the side panel opens
  // and the selected workflow plus its triggers and connected workflows light up
  // while the rest dim. Dwell on that, then select a second one to show it react.
  await page.click('button[aria-label="Fit view"]')
  await pause(1500)
  await selectViaSearch(page, 'a')
  await pause(3500)
  await selectViaSearch(page, 'i')
  await pause(3000)
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

  // 6. Credentials
  await page.click('nav.rail button[title="Credentials"]')
  await pause(3000)

  // 7. Data Tables — the table overview, then expand a row to reveal which
  // workflows use it.
  await page.click('nav.rail button[title="Data Tables"]')
  await pause(2500)
  const expand = page.locator('button.exp').first()
  if (await expand.count()) { await expand.click().catch(() => {}); await pause(2500) }

  // 8. Back to map beauty shot
  await page.click('nav.rail button[title="Map"]')
  await page.click('button[aria-label="Fit view"]')
  await pause(2000)
}

// Select a workflow by typing into the search box and clicking the first result.
// Position-independent; sets the selected id, which opens the side panel and
// triggers the trace-flow highlight on the map.
async function selectViaSearch(page: Page, query: string): Promise<void> {
  await page.fill('input[placeholder="Search workflows / webhooks…"]', query)
  await pause(900)
  const result = page.locator('.search .results li').first()
  if (await result.count()) await result.click()
}
