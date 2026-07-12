import { test, expect } from '@playwright/test'

test.use({ hasTouch: true })

test.beforeEach(async ({ page }) => {
  await page.goto('/explore')
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await page.getByRole('columnheader', { name: '総人口', exact: true }).click()
  await page.getByRole('button', { name: 'この列を地図に表示' }).click()
  await expect(page.locator('svg path').first()).toBeVisible()
})

// CDP's Input.dispatchTouchEvent drives real multi-touch input — the thing
// under test is whether the browser's own pinch-to-zoom-the-page gesture
// fires instead of the map's handler, which only a real touch dispatch
// (not a synthetic TouchEvent constructed in-page) exercises faithfully.
test('a two-finger pinch zooms the map, not the page', async ({ page }) => {
  // If React had attached the touch listeners as passive, preventDefault()
  // would silently no-op and Chromium logs a console warning about it —
  // catching that here confirms the belt-and-suspenders preventDefault()
  // backup (alongside touch-action: none) is actually taking effect.
  const consoleMessages: string[] = []
  page.on('console', msg => consoleMessages.push(msg.text()))

  const svg = page.getByTestId('map-svg')
  const box = await svg.boundingBox()
  if (!box) throw new Error('svg not visible')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  const group = page.locator('svg > g')
  const before = await group.getAttribute('transform')

  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: cx - 20, y: cy }, { x: cx + 20, y: cy }],
  })
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: cx - 60, y: cy }, { x: cx + 60, y: cy }],
  })
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: cx - 100, y: cy }, { x: cx + 100, y: cy }],
  })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

  const after = await group.getAttribute('transform')
  expect(after).not.toBe(before)
  const scale = Number(after?.match(/scale\(([\d.]+)\)/)?.[1])
  expect(scale).toBeGreaterThan(1)

  expect(consoleMessages.some(m => m.includes('passive'))).toBe(false)
})

test('a one-finger touch drag pans the map', async ({ page }) => {
  const svg = page.getByTestId('map-svg')
  const box = await svg.boundingBox()
  if (!box) throw new Error('svg not visible')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2

  const group = page.locator('svg > g')
  const before = await group.getAttribute('transform')

  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + 80, y: cy + 40 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })

  const after = await group.getAttribute('transform')
  expect(after).not.toBe(before)
})
