import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/search')
})

test('kana search (hiragana input) filters to the matching municipality', async ({ page }) => {
  // The codes source's readings are hiragana; normalizeKana must still line
  // up user input with stored readings so this keeps working regardless of
  // which script either side happens to use.
  await page.getByPlaceholder('かな（前方一致）').fill('よこはまし')
  await page.getByRole('button', { name: '適用' }).click()

  await expect(page.locator('tbody tr').first()).toBeVisible()
  await expect(page.getByRole('cell', { name: '横浜市', exact: true })).toBeVisible()
  expect(await page.locator('tbody tr').count()).toBe(1)
})

test('kana search also matches designated-city wards by their own reading', async ({ page }) => {
  // Ward readings aren't prefixed with the parent city's reading (the CSV's
  // yomigana column is per-row), so this ward-name search is expected to
  // match same-named wards across several designated cities, not just one.
  await page.getByPlaceholder('かな（前方一致）').fill('つるみく')
  await page.getByRole('button', { name: '適用' }).click()

  await expect(page.locator('tbody tr').first()).toBeVisible()
  await expect(page.getByRole('cell', { name: '横浜市鶴見区', exact: true })).toBeVisible()
  await expect(page.getByRole('cell', { name: '大阪市鶴見区', exact: true })).toBeVisible()
})
