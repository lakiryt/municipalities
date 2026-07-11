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

test('kana search does not surface designated-city wards — /search is restricted to official municipalities', async ({ page }) => {
  // Ward readings aren't prefixed with the parent city's reading (the CSV's
  // yomigana column is per-row), so if wards were included this would match
  // several designated cities' same-named wards. /search only ever shows
  // real 地方公共団体, so none of them should appear.
  await page.getByPlaceholder('かな（前方一致）').fill('つるみく')
  await page.getByRole('button', { name: '適用' }).click()

  await expect(page.locator('table')).toBeVisible()
  expect(await page.locator('tbody tr').count()).toBe(0)
})
