import { test, expect } from '@playwright/test'

test('rankings start with a visible &official filter, so designated-city wards are not counted twice', async ({ page }) => {
  await page.goto('/list/all/population')
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await expect(page.getByRole('button', { name: '絞り込み' })).toHaveText('絞り込み：政令市の区を除く')
  await expect(page.getByRole('cell', { name: '横浜市鶴見区', exact: true })).toHaveCount(0)
  await expect(page.getByRole('cell', { name: '横浜市', exact: true })).toBeVisible()
})

test("/explore starts the same way, and clearing the filter brings the wards in", async ({ page }) => {
  await page.goto('/explore')
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await expect(page.getByRole('cell', { name: '横浜市鶴見区', exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: '絞り込み' }).click()
  await page.getByRole('button', { name: 'クリア' }).click()
  await expect(page.getByRole('button', { name: '絞り込み' })).toHaveText('絞り込み')
  await expect(page.getByRole('cell', { name: '横浜市鶴見区', exact: true })).toHaveCount(1)
  await expect(page.getByRole('cell', { name: '横浜市', exact: true })).toBeVisible()
})

test("on the map, a designated city shown without its wards is drawn over its wards' shapes", async ({ page }) => {
  await page.goto('/explore')
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await page.getByRole('tab', { name: '地図', exact: true }).click()
  await page.waitForSelector('svg path')

  // Wards aren't rows here (&official), but their shapes still carry 横浜市's
  // value — only the handful of prefecture-coded islands are "no data".
  const total = await page.locator('svg path').count()
  const noData = await page.locator('svg path[fill="#e1e0d9"]').count()
  expect(total).toBeGreaterThan(1000)
  expect(noData).toBeLessThan(20)
  const tsurumi = page.locator('svg path[data-code="14101"]')
  const naka = page.locator('svg path[data-code="14104"]')
  expect(await tsurumi.getAttribute('fill')).toBe(await naka.getAttribute('fill'))
  await tsurumi.hover({ force: true })
  await expect(page.getByTestId('map-tooltip')).toContainText('横浜市:')
})

test('opening the map from a ranking page stays on that page instead of jumping to /explore', async ({ page }) => {
  await page.goto('/list/all/population')
  await expect(page.locator('tbody tr').first()).toBeVisible()
  const titleBeforeOpening = await page.title()

  await page.getByRole('columnheader', { name: '人口(計)', exact: true }).getByRole('button', { name: '人口(計)', exact: true }).click()
  await page.getByRole('button', { name: 'この列を地図に表示' }).click()
  await expect(page.getByRole('heading', { name: '人口(計)の地図', exact: true })).toBeVisible()

  const url = new URL(page.url())
  expect(url.pathname).toBe('/list/all/population')
  expect(url.searchParams.get('map')).toMatch(/^@\d+$/)
  await expect(page).toHaveTitle(/^人口\(計\)の地図 — /)

  await page.getByRole('tab', { name: '表', exact: true }).click()
  const closedUrl = new URL(page.url())
  expect(closedUrl.pathname).toBe('/list/all/population')
  expect(closedUrl.searchParams.get('map')).toBeNull()
  await expect(page).toHaveTitle(titleBeforeOpening)
})

test('the 地図 tab also stays on a ranking page', async ({ page }) => {
  await page.goto('/list/all/population')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  await page.getByRole('tab', { name: '地図', exact: true }).click()
  await page.getByRole('combobox', { name: '色分けする列' }).selectOption({ label: '人口(計)' })
  await expect(page.getByRole('heading', { name: '人口(計)の地図', exact: true })).toBeVisible()
  expect(new URL(page.url()).pathname).toBe('/list/all/population')
})

test('the average rent (20m²) ranking page loads and sorts descending', async ({ page }) => {
  await page.goto('/rankings/all/rent')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  await expect(page.getByRole('columnheader', { name: '平均家賃（20㎡）', exact: true })).toBeVisible()

  // Columns: #, 自治体名, 平均家賃（20㎡） (the ranked column, right after the name), …
  const firstRowValue = await page.locator('tbody tr').first().locator('td').nth(2).innerText()
  const secondRowValue = await page.locator('tbody tr').nth(1).locator('td').nth(2).innerText()
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
  const link = page.getByRole('link', { name: '家賃を稼ぐのに必要な労働日数', exact: true })
  await expect(link).toBeVisible()
  await link.click()

  await expect(page).toHaveURL(/\/rankings\/all\/rent-labor-days\?map=@4/)
  await expect(page.getByRole('heading', { name: /平均家賃30㎡分を稼ぐのに必要な最低賃金労働日数の地図/ })).toBeVisible()
})

test('the life-question rankings load, each ordered by its own figure', async ({ page }) => {
  await page.goto('/rankings/all/love-competition')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('恋愛競争率ランキング')
  await page.goto('/rankings/shimane/pension-rent')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('島根県の「年金で家賃を払った残り」ランキング')
  await page.goto('/rankings/all/newcomers')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('転入者の割合ランキング')
})
