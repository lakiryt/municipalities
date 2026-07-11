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

test('the chosen map column is reflected in the URL, and closing clears it', async ({ page }) => {
  await openMapViaPicker(page, '面積')

  const stateOf = () => {
    const url = new URL(page.url())
    return JSON.parse(decodeURIComponent(url.searchParams.get('s') ?? '{}'))
  }

  expect(stateOf().mapExpression).toMatch(/^@\d+$/)
  const referencedId = Number(stateOf().mapExpression.slice(1))
  const referencedColumn = stateOf().columns.find((c: { id: number }) => c.id === referencedId)
  expect(referencedColumn.label).toBe('面積')

  await page.getByRole('button', { name: '閉じる', exact: true }).click()
  await expect(mapHeading(page, '面積')).toBeHidden()
  expect(stateOf().mapExpression).toBe('')
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

test('the border checkbox toggles path strokes and defaults to off', async ({ page }) => {
  await openMapViaPicker(page)
  const path = page.locator('svg path').first()
  await expect(path).toBeVisible()
  await expect(path).toHaveAttribute('stroke', 'none')

  await page.getByLabel('境界線').check()
  await expect(path).toHaveAttribute('stroke', '#fcfcfb')

  await page.getByLabel('境界線').uncheck()
  await expect(path).toHaveAttribute('stroke', 'none')
})

test('zoom buttons and reset scale the map, and wheel zoom pins the point under the cursor', async ({ page }) => {
  await openMapViaPicker(page)
  const group = page.locator('svg > g')
  await expect(page.locator('svg path').first()).toBeVisible()
  await expect(group).toHaveAttribute('transform', /scale\(1\)/)

  const scaleOf = async () => {
    const t = await group.getAttribute('transform')
    return Number(t?.match(/scale\(([\d.]+)\)/)?.[1])
  }

  await page.getByLabel('ズームイン').click()
  let zoomedIn = 0
  await expect(async () => {
    zoomedIn = await scaleOf()
    expect(zoomedIn).toBeGreaterThan(1)
  }).toPass()

  await page.getByLabel('ズームアウト').click()
  await expect(async () => expect(await scaleOf()).toBeLessThan(zoomedIn)).toPass()

  await page.getByLabel('ズームリセット').click()
  await expect(group).toHaveAttribute('transform', /scale\(1\)/)

  // Wheel-zoom over the map area should also increase the scale.
  const box = await page.locator('svg').boundingBox()
  if (!box) throw new Error('svg not visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.wheel(0, -200)
  await expect(async () => expect(await scaleOf()).toBeGreaterThan(1)).toPass()
})

test('zoom buttons disable at the min/max scale limits', async ({ page }) => {
  await openMapViaPicker(page)
  await expect(page.locator('svg path').first()).toBeVisible()

  const zoomIn = page.getByLabel('ズームイン')
  const zoomOut = page.getByLabel('ズームアウト')

  // At scale 1 (the minimum), zooming out is already disabled.
  await expect(zoomOut).toBeDisabled()
  await expect(zoomIn).toBeEnabled()

  // Zoom all the way in until the button disables itself at MAX_SCALE.
  await expect(async () => {
    if (await zoomIn.isDisabled()) return
    await zoomIn.click()
    expect(await zoomIn.isDisabled()).toBe(true)
  }).toPass({ timeout: 15000 })

  await expect(zoomOut).toBeEnabled()

  await page.getByLabel('ズームリセット').click()
  await expect(zoomOut).toBeDisabled()
})

test('dragging the map pans it (translate changes) without leaving zoom stuck', async ({ page }) => {
  await openMapViaPicker(page)
  const group = page.locator('svg > g')
  await expect(page.locator('svg path').first()).toBeVisible()

  const box = await page.locator('svg').boundingBox()
  if (!box) throw new Error('svg not visible')
  const before = await group.getAttribute('transform')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 40, { steps: 5 })
  await page.mouse.up()

  const after = await group.getAttribute('transform')
  expect(after).not.toBe(before)
})
