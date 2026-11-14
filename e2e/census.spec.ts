import { test, expect } from '@playwright/test'

test('the population-change ranking compares two censuses by default, highest growth first', async ({ page }) => {
  await page.goto('/rankings/all/population-change')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^全国の市区町村の人口増加率ランキング（\d{4}→\d{4}年）$/)
  await expect(page.locator('tbody tr').first()).toBeVisible()

  // Its data chip names the comparison.
  await expect(page.getByRole('button', { name: /人口増減\s*国勢調査 \d{4}→\d{4}年/ })).toBeVisible()

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

test('a change rate maps on a diverging scale around 0, with outliers clipped by default', async ({ page }) => {
  await page.goto('/rankings/all/population-change?map=@1')
  await page.waitForSelector('svg path[data-code]')
  const scaleSelect = page.getByRole('combobox', { name: '目盛り' })
  await expect(scaleSelect.locator('option:checked')).toHaveText('自動（増減）')
  const clip = page.getByRole('checkbox', { name: /外れ値/ })
  await expect(clip).toBeChecked()
  await expect(page.getByText('中央の色 ≒ 0')).toBeVisible()

  // Turning clipping off is remembered as an explicit choice (the checkbox
  // reflects the URL, which updates a moment after the click).
  await clip.click()
  await expect(page).toHaveURL(/clip=0/)
  await expect(clip).not.toBeChecked()
})

test('人口増減 is chosen in データの選択: switching to 住民基本台帳 retitles the ranking and its columns', async ({ page }) => {
  await page.goto('/rankings/all/population-change')
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await page.getByRole('button', { name: /人口増減\s*国勢調査/ }).click()

  const dialog = page.getByRole('dialog', { name: 'データの選択' })
  await dialog.getByRole('radio', { name: /住民基本台帳/ }).check()
  await dialog.getByRole('button', { name: '適用' }).click()

  await expect(page).toHaveURL(/[?&]change=jumin/)
  await expect(page.getByRole('button', { name: /人口増減\s*住民基本台帳 \d{4}→\d{4}年/ })).toBeVisible()
  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toHaveText(/（\d{4}→\d{4}年）$/)
  const [, y0, y1] = (await heading.innerText()).match(/（(\d{4})→(\d{4})年）/)!
  await expect(page.getByRole('columnheader', { name: `人口（${y1}年）`, exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: `人口（${y0}年）`, exact: true })).toBeVisible()
  const rates = (await page.locator('tbody tr td:nth-child(3)').allInnerTexts()).slice(0, 10).map(Number)
  expect(rates.length).toBe(10)
  expect([...rates].sort((a, b) => b - a)).toEqual(rates)
})
