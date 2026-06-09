import type { Page } from 'playwright'

const FAKE_HOST = 'https://n8n.demo.example'
const pause = (ms: number) => new Promise(r => setTimeout(r, ms))

export async function runTour(page: Page, jsonPath: string, appUrl = 'http://localhost:3000'): Promise<void> {
  // 1. Load app
  await page.goto(appUrl)
  await page.waitForSelector('.toolbar', { timeout: 30_000 })
  await pause(1000)

  // 2. Upload anonymized JSON via the real Upload-JSON flow
  await page.fill('input[placeholder="instance URL (optional, for links)"]', FAKE_HOST)
  await page.setInputFiles('input[type="file"]', jsonPath)
  await page.waitForSelector('.vue-flow__node', { timeout: 30_000 })
  await pause(1500)

  // 3. Map + the trace-flow "magic". The map auto-fits on load; clicking a real
  // workflow node (not a search pick) is what triggers the app's centre-on-click,
  // the side panel, and the trace-flow highlight where the workflow plus its
  // triggers and connected workflows light up while the rest dim. The view stays
  // at the fit-all zoom (centre-on-click keeps the zoom), so nodes remain
  // clickable. Falls back to search selection if no node is hittable.
  await pause(2000)
  if (!(await clickNodeByKind(page, 'kind-workflow'))) await selectViaSearch(page, 'a')
  await pause(3500)

  // 3b. First-class resources: data tables already show as nodes; open the
  // Layers panel and switch on Credentials so they join the map as nodes too.
  await showResourcesLayer(page)
  await pause(1500)
  // Click a data table node — it centres and opens its panel (columns + the
  // workflows that use it).
  if (await clickNodeByKind(page, 'kind-dataTable')) await pause(3000)
  await pause(800)

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

  // 8. Back to map beauty shot — remounting the map auto-fits the whole graph.
  await page.click('nav.rail button[title="Map"]')
  await pause(2500)
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

// Click a map node of a given kind ('kind-workflow' | 'kind-dataTable' |
// 'kind-credential' | 'kind-trigger') the way a real user does, so the app's
// onNodeClick fires (centre-on-click + side panel + highlight). All Vue Flow
// nodes share the same wrapper class; the kind lives on the inner card. We click
// at the node's bounding-box centre via the mouse, which works even when
// element-level actionability checks would balk on the transformed canvas.
// Returns false if no such node is on screen (caller can fall back).
async function clickNodeByKind(page: Page, kindClass: string, nth = 0): Promise<boolean> {
  const node = page.locator(`.vue-flow__node:has(.${kindClass})`).nth(nth)
  if (!(await node.count())) return false
  const box = await node.boundingBox()
  if (!box) return false
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  return true
}

// Open the Layers panel and enable the Credentials resource layer so credentials
// appear as first-class nodes on the map (data tables are on by default). Best
// effort: any missing control is skipped rather than failing the tour.
async function showResourcesLayer(page: Page): Promise<void> {
  try {
    const layers = page.locator('button:has-text("Layers")').first()
    if (!(await layers.count())) return
    await layers.click()
    await pause(800)
    const credToggle = page.locator('label:has-text("Credentials") input[type="checkbox"]').first()
    if (await credToggle.count()) { await credToggle.check().catch(() => {}); await pause(1500) }
    await layers.click().catch(() => {})
    await pause(500)
  } catch { /* leave the map as-is */ }
}
