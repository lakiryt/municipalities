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

test('the average rent (20m²) ranking page loads and sorts descending', async ({ page }) => {
  await page.goto('/rankings/all/rent')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  await expect(page.getByRole('columnheader', { name: '平均家賃（20㎡）', exact: true })).toBeVisible()

  const firstRowValue = await page.locator('tbody tr').first().locator('td').last().innerText()
  const secondRowValue = await page.locator('tbody tr').nth(1).locator('td').last().innerText()
  const parse = (s: string) => Number(s.replace(/[^0-9.]/g, ''))
  expect(parse(firstRowValue)).toBeGreaterThanOrEqual(parse(secondRowValue))
})

test('the rent-vs-minimum-wage labor-days ranking page loads with all its columns, and the homepage link opens its map', async ({ page }) => {
  await page.goto('/rankings/all/rent-labor-days')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  for (const label of ['都道府県', '自治体名', '平均家賃（30㎡）', '最低賃金', '平均家賃30㎡分を稼ぐのに必要な最低賃金労働日数']) {
    await expect(page.getByRole('columnheader', { name: label, exact: true })).toBeVisible()
  }

  await page.goto('/')
  const link = page.getByRole('link', { name: /最低賃金労働日数ランキング/ })
  await expect(link).toBeVisible()
  await link.click()

  await expect(page).toHaveURL(/\/rankings\/all\/rent-labor-days\?map=@4/)
  await expect(page.getByRole('heading', { name: /平均家賃30㎡分を稼ぐのに必要な最低賃金労働日数の地図/ })).toBeVisible()
})
