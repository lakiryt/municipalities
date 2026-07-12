import { test, expect } from '@playwright/test'

test('ranking pages restrict to official municipalities, excluding designated-city wards', async ({ page }) => {
  await page.goto('/list/all/population')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  // 横浜市鶴見区 is a real row in the full CSV (it's on the map), but it's a
  // ward of a designated city, not its own 地方公共団体 — rankings should
  // never show it.
  await expect(page.getByRole('cell', { name: '横浜市鶴見区', exact: true })).toHaveCount(0)
  // The parent city itself is a real municipality and should still appear.
  await expect(page.getByRole('cell', { name: '横浜市', exact: true })).toBeVisible()
})

test("/explore's table is also restricted to official municipalities", async ({ page }) => {
  await page.goto('/explore')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  await expect(page.getByRole('cell', { name: '横浜市鶴見区', exact: true })).toHaveCount(0)
  await expect(page.getByRole('cell', { name: '横浜市', exact: true })).toBeVisible()
})

test("/explore's map still colors designated-city wards even though its table is restricted", async ({ page }) => {
  await page.goto('/explore')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  // Open the map for 総人口 via a column's own action, since it's not one of
  // the table's rows anymore.
  await page.getByRole('columnheader', { name: '総人口', exact: true }).click()
  await page.getByRole('button', { name: 'この列を地図に表示' }).click()
  await page.waitForSelector('svg path')

  // If wards had been dropped along with the table's restriction, almost all
  // ~170 of their paths would render as "no data" gray — instead only the
  // handful of prefecture-coded islands should.
  const total = await page.locator('svg path').count()
  const noData = await page.locator('svg path[fill="#e1e0d9"]').count()
  expect(total).toBeGreaterThan(1000)
  expect(noData).toBeLessThan(20)
})

test('opening the map from a ranking page stays on that page instead of jumping to /explore', async ({ page }) => {
  await page.goto('/list/all/population')
  await expect(page.locator('tbody tr').first()).toBeVisible()
  const titleBeforeOpening = await page.title()

  await page.getByRole('columnheader', { name: '人口(計)', exact: true }).click()
  await page.getByRole('button', { name: 'この列を地図に表示' }).click()
  await expect(page.getByRole('heading', { name: '人口(計)の地図', exact: true })).toBeVisible()

  const url = new URL(page.url())
  expect(url.pathname).toBe('/list/all/population')
  expect(url.searchParams.get('map')).toMatch(/^@\d+$/)
  await expect(page).toHaveTitle(/^人口\(計\)の地図 — /)

  await page.getByRole('button', { name: '閉じる', exact: true }).click()
  const closedUrl = new URL(page.url())
  expect(closedUrl.pathname).toBe('/list/all/population')
  expect(closedUrl.searchParams.get('map')).toBeNull()
  await expect(page).toHaveTitle(titleBeforeOpening)
})

test('the map picker (toolbar button) also stays on a ranking page', async ({ page }) => {
  await page.goto('/list/all/population')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  await page.getByRole('button', { name: '地図表示', exact: true }).click()
  await page.getByRole('button', { name: '人口(計)', exact: true }).click()
  await expect(page.getByRole('heading', { name: '人口(計)の地図', exact: true })).toBeVisible()

  expect(new URL(page.url()).pathname).toBe('/list/all/population')
})
