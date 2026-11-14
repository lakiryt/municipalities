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

test('kana search also finds designated-city wards (they have rows of their own); 種別 narrows them out', async ({ page }) => {
  await page.getByPlaceholder('かな（前方一致）').fill('つるみく')
  await page.getByRole('button', { name: '適用' }).click()
  await expect(page.getByRole('cell', { name: '横浜市鶴見区', exact: true })).toBeVisible()

  await page.getByRole('button', { name: '絞り込み' }).click()
  await page.getByRole('button', { name: 'クリア' }).click()
  await page.goto('/search')
  await page.getByPlaceholder('かな（前方一致）').fill('つるみく')
  await page.getByRole('checkbox', { name: '市', exact: true }).check()
  await page.getByRole('button', { name: '適用' }).click()
  await expect(page.locator('table')).toBeVisible()
  expect(await page.locator('tbody tr').count()).toBe(0)
})
