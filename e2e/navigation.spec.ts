import { test, expect } from '@playwright/test'

test('editing a column on a ranking page redirects to /explore, preserving the edit', async ({ page }) => {
  await page.goto('/rankings/all/population-over-500k')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  await page.getByRole('columnheader', { name: '総人口', exact: true }).click()
  await page.getByPlaceholder('列名').fill('人口(編集)')
  await page.getByRole('button', { name: '保存' }).click()

  await expect(page).toHaveURL(/\/explore\?s=/)
  await expect(page.getByRole('columnheader', { name: '人口(編集)' })).toBeVisible()
})

test('browser back/forward replays column edits made while staying on /explore', async ({ page }) => {
  await page.goto('/explore')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  const addColumn = async (label: string) => {
    await page.getByRole('columnheader', { name: '+', exact: true }).click()
    await page.getByPlaceholder('列名').fill(label)
    await page.getByPlaceholder(/SUM\(#inc_mov/).fill('#area')
    await page.getByRole('button', { name: '保存' }).click()
    await expect(page.getByRole('columnheader', { name: label })).toBeVisible()
  }

  await addColumn('列A')
  await addColumn('列B')

  await page.goBack()
  await expect(page.getByRole('columnheader', { name: '列B' })).toHaveCount(0)
  await expect(page.getByRole('columnheader', { name: '列A' })).toBeVisible()

  await page.goForward()
  await expect(page.getByRole('columnheader', { name: '列B' })).toBeVisible()
})

test('a malformed ?s= URL falls back to the default columns instead of crashing', async ({ page }) => {
  await page.goto('/explore?s=this-is-not-valid-json')

  await expect(page.locator('tbody tr').first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '総人口', exact: true })).toBeVisible()
})

test('the filter modal offers a column-reference picker that inserts @id at the cursor', async ({ page }) => {
  await page.goto('/explore')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  await page.getByRole('button', { name: '絞り込み', exact: true }).click()
  // Default seeded columns are id 0..4 in order; "総人口" is the 4th (id 3).
  await page.getByRole('button', { name: /^@\d+\s+総人口$/ }).click()

  await expect(page.getByPlaceholder(/AND\(EQ/)).toHaveValue('@3')
})
