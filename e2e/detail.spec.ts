import { test, expect } from '@playwright/test'

test('a name in a ranking links to its detail page, which shows its figures with ranks', async ({ page }) => {
  await page.goto('/rankings/all/density')
  await page.getByRole('link', { name: '豊島区', exact: true }).click()

  await expect(page).toHaveURL(/\/m\/13116$/)
  await expect(page.getByRole('heading', { level: 1, name: '豊島区' })).toBeVisible()
  await expect(page).toHaveTitle(/^豊島区（東京都）の人口/)
  // The densest municipality in Japan.
  await expect(page.getByTestId('metric-density')).toContainText('全国 1位 / 1,747')
  await expect(page.getByTestId('metric-pop')).toContainText(/\d{3},\d{3}\s*人/)
})

test('the detail page draws the population trend, the age pyramid, and links to its neighbors', async ({ page }) => {
  await page.goto('/m/01209')
  await expect(page.getByRole('heading', { level: 1, name: '夕張市' })).toBeVisible()

  await expect(page.getByRole('img', { name: /^人口の推移：2020年/ })).toBeVisible()
  await expect(page.getByRole('img', { name: /人口ピラミッド/ })).toBeVisible()

  const neighbors = page.getByTestId('neighbors')
  await expect(neighbors.getByRole('link', { name: '岩見沢市' })).toBeVisible()
  await neighbors.getByRole('link', { name: '岩見沢市' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '岩見沢市' })).toBeVisible()
})

test('a designated-city ward links back to its city and is not ranked', async ({ page }) => {
  await page.goto('/m/01101')
  await expect(page.getByRole('heading', { level: 1, name: '札幌市中央区' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'パンくず' }).getByRole('link', { name: '札幌市' })).toBeVisible()
  await expect(page.getByTestId('metric-pop')).not.toContainText('全国')
})

test('the data selection carries over from a table to the detail page', async ({ page }) => {
  await page.goto('/rankings/all/density?pop=jumin:2020')
  await page.getByRole('link', { name: '豊島区', exact: true }).click()
  await expect(page).toHaveURL(/\/m\/13116\?pop=jumin%3A2020/)
  await expect(page.getByRole('button', { name: /^人口\s*住民基本台帳 2020-01-01/ })).toBeVisible()
})

test('an unknown code shows a not-found message', async ({ page }) => {
  await page.goto('/m/99999')
  await expect(page.getByRole('heading', { name: '自治体が見つかりません' })).toBeVisible()
})
