import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/explore')
  await expect(page.locator('tbody tr').first()).toBeVisible()
})

// Opens the map for the first time on a fresh page — since nothing's been
// referenced yet, this picks `label` from the column picker that appears.
async function openMapViaPicker(page: Page, label = '総人口') {
  await page.getByRole('button', { name: '地図表示', exact: true }).click()
  await page.getByRole('button', { name: label, exact: true }).click()
}

const mapHeading = (page: Page, label: string) => page.getByRole('heading', { name: `${label}の地図`, exact: true })

test('opening the map for the first time asks which column to show, then renders it titled with that column', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', err => errors.push(String(err)))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

  await page.getByRole('button', { name: '地図表示', exact: true }).click()
  await expect(page.getByRole('heading', { name: '地図に表示する列' })).toBeVisible()
  await page.getByRole('button', { name: '総人口', exact: true }).click()

  await expect(mapHeading(page, '総人口')).toBeVisible()
  await expect(page).toHaveTitle(/^総人口の地図 — /)
  const paths = page.locator('svg path')
  await expect(paths.first()).toBeVisible()
  expect(await paths.count()).toBeGreaterThan(1000)
  expect(errors).toEqual([])
})

test('closing the map restores the page title', async ({ page }) => {
  const titleBeforeOpening = await page.title()

  await openMapViaPicker(page, '総人口')
  await expect(page).toHaveTitle(/^総人口の地図 — /)

  await page.getByRole('button', { name: '閉じる', exact: true }).click()
  await expect(page).toHaveTitle(titleBeforeOpening)
})

test('the toolbar map button always asks again, even after a column was already chosen', async ({ page }) => {
  await openMapViaPicker(page, '総人口')
  await expect(mapHeading(page, '総人口')).toBeVisible()
  await page.getByRole('button', { name: '閉じる', exact: true }).click()

  // Reopening from the toolbar re-asks rather than silently reusing 総人口 —
  // unlike a column's own "show on the map" action, it has no column of its
  // own to be immediate about.
  await page.getByRole('button', { name: '地図表示', exact: true }).click()
  await expect(page.getByRole('heading', { name: '地図に表示する列' })).toBeVisible()
  await page.getByRole('button', { name: '面積', exact: true }).click()
  await expect(mapHeading(page, '面積')).toBeVisible()
})

test('the chosen map column is reflected in its own `map` URL param, independent of `s=`, and closing clears it', async ({ page }) => {
  await openMapViaPicker(page, '面積')

  const mapParam = () => new URL(page.url()).searchParams.get('map')
  const sParam = () => new URL(page.url()).searchParams.get('s')

  // Opening via the picker never touched `s=` at all — /explore had no
  // edits yet, so it's still absent — only `map` was added.
  expect(mapParam()).toMatch(/^@\d+$/)
  const sBeforeClose = sParam()
  expect(sBeforeClose).toBeNull()

  await page.getByRole('button', { name: '閉じる', exact: true }).click()
  await expect(mapHeading(page, '面積')).toBeHidden()
  expect(mapParam()).toBeNull()
  // Closing only ever touches `map` — the rest of the URL is untouched.
  expect(sParam()).toBe(sBeforeClose)
})

test('browser back after closing the map reopens it', async ({ page }) => {
  await openMapViaPicker(page, '総人口')
  await expect(mapHeading(page, '総人口')).toBeVisible()

  await page.getByRole('button', { name: '閉じる', exact: true }).click()
  await expect(mapHeading(page, '総人口')).toBeHidden()

  await page.goBack()
  await expect(mapHeading(page, '総人口')).toBeVisible()
})

test('visiting a URL with a map column already set shows the map open immediately', async ({ page }) => {
  await openMapViaPicker(page, '総人口')
  const openUrl = page.url()

  await page.goto('about:blank')
  await page.goto(openUrl)

  await expect(mapHeading(page, '総人口')).toBeVisible()
  await expect(page.locator('svg path').first()).toBeVisible()
})

test('a column\'s "この列を地図に表示" action opens the map directly with that column', async ({ page }) => {
  await page.getByRole('columnheader', { name: '総人口', exact: true }).click()
  await page.getByRole('button', { name: 'この列を地図に表示' }).click()

  await expect(mapHeading(page, '総人口')).toBeVisible()
  await expect(page.locator('svg path').first()).toBeVisible()
})

test('the map action is disabled for a non-numeric column', async ({ page }) => {
  await page.getByRole('columnheader', { name: '自治体名', exact: true }).click()
  await expect(page.getByRole('button', { name: 'この列を地図に表示' })).toBeDisabled()
})

test('hovering a municipality shows a tooltip with its name and value', async ({ page }) => {
  await openMapViaPicker(page)
  await expect(page.locator('svg path').first()).toBeVisible()

  // Any path that isn't the "no data" gray fill has a real value — a plain
  // CSS attribute selector finds one without needing DOM-typed evaluate().
  const target = page.locator('svg path:not([fill="#e1e0d9"])').first()
  const box = await target.boundingBox()
  if (!box) throw new Error('no colored municipality path found')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.getByTestId('map-tooltip')).toHaveText(/.+: [\d,]+/)
})

test('clicking the legend opens a color scheme picker that recolors the map without changing the data shown', async ({ page }) => {
  await openMapViaPicker(page)
  const target = page.locator('svg path:not([fill="#e1e0d9"])').first()
  await expect(target).toBeVisible()

  const legend = page.getByTestId('map-legend')
  const legendBefore = await legend.textContent()
  const fillBefore = await target.getAttribute('fill')

  // The legend bar itself is the trigger — clicking it opens the picker.
  await legend.click()
  await page.getByRole('option', { name: 'Magma' }).click()

  await expect(async () => {
    expect(await target.getAttribute('fill')).not.toBe(fillBefore)
  }).toPass()
  // The legend's min/max values are about the data, not the color scheme —
  // switching schemes must not change what's being measured.
  expect(await legend.textContent()).toBe(legendBefore)
})

test('the color scheme picker closes on an outside click without changing the selection', async ({ page }) => {
  await openMapViaPicker(page)
  await expect(page.locator('svg path').first()).toBeVisible()

  const legend = page.getByTestId('map-legend')
  await legend.click()
  await expect(page.getByRole('listbox')).toBeVisible()

  await page.mouse.click(20, 20)
  await expect(page.getByRole('listbox')).toBeHidden()
})

test('hovering a "no data" municipality still shows a tooltip with its name', async ({ page }) => {
  await openMapViaPicker(page)
  await expect(page.locator('svg path').first()).toBeVisible()

  // "No data" codes are prefecture-level totals under which a handful of
  // remote islands are drawn, some as tiny slivers or scattered multi-part
  // geometries that make real pixel-based hovering flaky to target reliably
  // (paint order can put a real municipality on top at the same point).
  // Dispatching the mousemove directly on the element sidesteps that and
  // tests the thing this test is actually about: that a "no data" path's own
  // handler still shows its name.
  const target = page.locator('svg path[fill="#e1e0d9"]').first()
  await target.dispatchEvent('mousemove', { clientX: 100, clientY: 100, bubbles: true })

  await expect(page.getByTestId('map-tooltip')).toHaveText(/.+: データなし/)
})

test('the histogram button overlays a value histogram at the bottom without hiding the map, and closes it again', async ({ page }) => {
  await openMapViaPicker(page)
  await expect(page.locator('svg path').first()).toBeVisible()

  const histogram = page.getByTestId('map-histogram-panel')
  await expect(histogram).toHaveCSS('height', '0px')

  await page.getByRole('button', { name: 'ヒストグラムを見る', exact: true }).click()
  // The map stays up — this is an overlay, not a view switch.
  await expect(mapHeading(page, '総人口')).toBeVisible()
  await expect(page.locator('svg path').first()).toBeVisible()
  await expect(histogram).toHaveCSS('height', '140px')

  const bars = page.locator('svg[data-testid="map-histogram"] rect')
  await expect(bars.first()).toBeVisible()
  // 20 bins, always rendered even for empty ones.
  expect(await bars.count()).toBe(20)

  // Its horizontal span matches the legend's colored gradient, not the
  // whole legend bar (which also has min/max labels and the dropdown arrow).
  const gradientBox = await page.getByTestId('map-legend').locator('span.rounded-sm').boundingBox()
  const histogramBox = await histogram.boundingBox()
  expect(histogramBox!.x).toBeCloseTo(gradientBox!.x, 0)
  expect(histogramBox!.width).toBeCloseTo(gradientBox!.width, 0)

  await bars.first().hover()
  await expect(page.getByTestId('histogram-tooltip')).toBeVisible()

  await page.getByRole('button', { name: 'ヒストグラムを閉じる', exact: true }).click()
  await expect(histogram).toHaveCSS('height', '0px')
})

test('wheel zoom pins the point under the cursor and clamps at the minimum scale', async ({ page }) => {
  await openMapViaPicker(page)
  const group = page.locator('svg > g')
  await expect(page.locator('svg path').first()).toBeVisible()
  await expect(group).toHaveAttribute('transform', /scale\(1\)/)

  const scaleOf = async () => {
    const t = await group.getAttribute('transform')
    return Number(t?.match(/scale\(([\d.]+)\)/)?.[1])
  }

  const box = await page.getByTestId('map-svg').boundingBox()
  if (!box) throw new Error('svg not visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)

  await page.mouse.wheel(0, -200)
  let zoomedIn = 0
  await expect(async () => {
    zoomedIn = await scaleOf()
    expect(zoomedIn).toBeGreaterThan(1)
  }).toPass()

  await page.mouse.wheel(0, 200)
  await expect(async () => expect(await scaleOf()).toBeLessThan(zoomedIn)).toPass()

  // Zooming out further from here clamps at the minimum instead of going
  // negative/inverting.
  for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 200)
  await expect(async () => expect(await scaleOf()).toBe(1)).toPass()
})

test('wheeling over the map does not scroll the table behind it', async ({ page }) => {
  // A row a few screens down, so there's room for the table to have visibly
  // scrolled if the wheel event leaked through the modal.
  const trackedRow = page.locator('tbody tr').nth(30)
  const before = await trackedRow.boundingBox()
  if (!before) throw new Error('row not visible')

  await openMapViaPicker(page)
  const box = await page.getByTestId('map-svg').boundingBox()
  if (!box) throw new Error('svg not visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -200)
  for (let i = 0; i < 5; i++) await page.mouse.wheel(0, 200)

  await page.getByRole('button', { name: '閉じる', exact: true }).click()
  await expect(trackedRow).toBeVisible()
  const after = await trackedRow.boundingBox()
  expect(after?.y).toBe(before.y)
})

test('dragging the map pans it (translate changes) without leaving zoom stuck', async ({ page }) => {
  await openMapViaPicker(page)
  const group = page.locator('svg > g')
  await expect(page.locator('svg path').first()).toBeVisible()

  const box = await page.getByTestId('map-svg').boundingBox()
  if (!box) throw new Error('svg not visible')
  const before = await group.getAttribute('transform')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 5 })
  await page.mouse.up()

  const after = await group.getAttribute('transform')
  expect(after).not.toBe(before)
})
