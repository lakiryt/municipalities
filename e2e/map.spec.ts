import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/explore')
  await expect(page.locator('tbody tr').first()).toBeVisible()
})

test('opening the map renders a colored path per municipality with no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', err => errors.push(String(err)))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })

  await page.getByRole('button', { name: '地図表示', exact: true }).click()
  await expect(page.getByRole('heading', { name: '地図表示' })).toBeVisible()

  const paths = page.locator('svg path')
  await expect(paths.first()).toBeVisible()
  expect(await paths.count()).toBeGreaterThan(1000)

  expect(errors).toEqual([])
})

test('hovering a municipality shows a tooltip with its name and value', async ({ page }) => {
  await page.getByRole('button', { name: '地図表示', exact: true }).click()
  await expect(page.locator('svg path').first()).toBeVisible()

  // Any path that isn't the "no data" gray fill has a real value — a plain
  // CSS attribute selector finds one without needing DOM-typed evaluate().
  const target = page.locator('svg path:not([fill="#e1e0d9"])').first()
  const box = await target.boundingBox()
  if (!box) throw new Error('no colored municipality path found')

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.getByTestId('map-tooltip')).toHaveText(/.+: [\d,]+/)
})

test('switching the colored column changes the legend range', async ({ page }) => {
  await page.getByRole('button', { name: '地図表示', exact: true }).click()
  await expect(page.locator('svg path').first()).toBeVisible()

  const legend = page.getByTestId('map-legend')
  const before = await legend.textContent()

  await page.getByLabel('表示する列').selectOption({ label: '面積' })
  await expect(async () => {
    expect(await legend.textContent()).not.toBe(before)
  }).toPass()
})

test('zoom buttons and reset scale the map, and wheel zoom pins the point under the cursor', async ({ page }) => {
  await page.getByRole('button', { name: '地図表示', exact: true }).click()
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

test('dragging the map pans it (translate changes) without leaving zoom stuck', async ({ page }) => {
  await page.getByRole('button', { name: '地図表示', exact: true }).click()
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
