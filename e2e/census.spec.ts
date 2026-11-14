import { test, expect } from '@playwright/test'

// 人口増減率 compares the two latest 国勢調査, whatever データの選択 says.
test('the population-change ranking compares two censuses, highest growth first', async ({ page }) => {
  await page.goto('/rankings/all/population-change')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^全国の市区町村の人口増加率ランキング（\d{4}→\d{4}年）$/)
  await expect(page.locator('tbody tr').first()).toBeVisible()

  // The census comparison shows as its own (fixed) data chip and in 出典.
  await expect(page.getByText(/国勢調査 \d{4}年→\d{4}年/)).toBeVisible()
  await expect(page.getByText(/出典：.*国勢調査/)).toBeVisible()

  // Rates are sorted high → low, and a municipality whose earlier census
  // count was 0 (双葉町, under evacuation order in 2020) is left out.
  const rates = (await page.locator('tbody tr td:nth-child(3)').allInnerTexts()).slice(0, 20).map(Number)
  expect(rates.length).toBeGreaterThan(10)
  expect([...rates].sort((a, b) => b - a)).toEqual(rates)
  await expect(page.getByRole('cell', { name: '双葉町', exact: true })).toHaveCount(0)
})

test('the decline ranking for a prefecture lists only that prefecture, steepest decline first', async ({ page }) => {
  await page.goto('/rankings/ishikawa/population-decline')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^石川県の市区町村の人口減少率ランキング/)
  const first = page.locator('tbody tr').first()
  await expect(first).toBeVisible()
  const rates = (await page.locator('tbody tr td:nth-child(3)').allInnerTexts()).map(Number)
  expect(rates[0]).toBeLessThan(0)
  expect([...rates].sort((a, b) => a - b)).toEqual(rates)
  // 19 市町 in 石川県
  expect(rates.length).toBe(19)
})

test('designated cities are listed by population', async ({ page }) => {
  await page.goto('/rankings/all/designated-cities')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('政令指定都市一覧（人口順）')
  await expect(page.locator('tbody tr')).toHaveCount(20)
  await expect(page.locator('tbody tr').first().getByRole('cell', { name: '横浜市', exact: true })).toBeVisible()
})

test('town and village rankings keep to their kind', async ({ page }) => {
  await page.goto('/rankings/hokkaido/villages')
  await expect(page.locator('tbody tr').first()).toBeVisible()
  const names = await page.locator('tbody tr td:nth-child(2)').allInnerTexts()
  expect(names.length).toBeGreaterThan(5)
  expect(names.every(n => n.endsWith('村'))).toBe(true)
})
