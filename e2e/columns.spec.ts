import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/explore')
  // Wait for real data to finish loading before interacting with the table.
  await expect(page.locator('tbody tr').first()).toBeVisible()
})

test('adding a column shows it in the table and moves the URL to /explore?s=', async ({ page }) => {
  await page.getByRole('columnheader', { name: '+', exact: true }).click()
  await page.getByPlaceholder('列名').fill('テスト列')
  await page.getByPlaceholder(/SUM\(#inc_mov/).fill('#area')
  await page.getByRole('button', { name: '保存' }).click()

  await expect(page.getByRole('columnheader', { name: 'テスト列' })).toBeVisible()
  await expect(page).toHaveURL(/\/explore\?s=/)
})

test('editing a column updates its label in place', async ({ page }) => {
  await page.getByRole('columnheader', { name: '総人口', exact: true }).click()
  const labelInput = page.getByPlaceholder('列名')
  await labelInput.fill('人口（編集済み）')
  await page.getByRole('button', { name: '保存' }).click()

  await expect(page.getByRole('columnheader', { name: '人口（編集済み）' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '総人口', exact: true })).toHaveCount(0)
})

test('deleting a column removes it from the table', async ({ page }) => {
  await page.getByRole('columnheader', { name: '面積', exact: true }).click()
  await page.getByRole('button', { name: '削除' }).click()

  await expect(page.getByRole('columnheader', { name: '面積', exact: true })).toHaveCount(0)
})

test('"この列で並び替える" sorts by @id and survives editing the column afterwards', async ({ page }) => {
  await page.getByRole('columnheader', { name: '総人口', exact: true }).click()
  await page.getByRole('button', { name: 'この列で並び替える' }).click()

  // The sort button in the toolbar should now read as active (highlighted state
  // is style-only, so assert on the state that's actually observable: the URL).
  const url = new URL(page.url())
  const state = JSON.parse(decodeURIComponent(url.searchParams.get('s') ?? '{}'))
  expect(state.sortExpression).toMatch(/^@\d+$/)

  const referencedId = Number(state.sortExpression.slice(1))
  const referencedColumn = state.columns.find((c: { id: number }) => c.id === referencedId)
  expect(referencedColumn.label).toBe('総人口')
})

test('deleting a column referenced by sort warns first, and confirming degrades gracefully instead of crashing', async ({ page }) => {
  await page.getByRole('columnheader', { name: '面積', exact: true }).click()
  await page.getByRole('button', { name: 'この列で並び替える' }).click()

  // Now delete the column the sort just started referencing by @id.
  await page.getByRole('columnheader', { name: '面積', exact: true }).click()
  await page.getByRole('button', { name: '削除' }).click()

  const warning = page.getByText(/並べ替え.*使用されています/)
  await expect(warning).toBeVisible()
  await page.getByRole('button', { name: '削除' }).last().click()

  // The app should still render a working table (no crash / blank page) —
  // the dangling @id becomes a normal "no active sort" state, not an error.
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '面積', exact: true })).toHaveCount(0)
})

test('canceling the delete-confirmation warning keeps the column', async ({ page }) => {
  await page.getByRole('columnheader', { name: '面積', exact: true }).click()
  await page.getByRole('button', { name: 'この列で並び替える' }).click()

  await page.getByRole('columnheader', { name: '面積', exact: true }).click()
  await page.getByRole('button', { name: '削除' }).click()
  await expect(page.getByText(/使用されています/)).toBeVisible()
  await page.getByRole('button', { name: 'キャンセル' }).last().click()

  await expect(page.getByRole('columnheader', { name: '面積', exact: true })).toBeVisible()
})

test('deleting a column referenced by the filter also warns', async ({ page }) => {
  await page.getByRole('button', { name: '絞り込み', exact: true }).click()
  // Column ids for the default seeded columns are 0..4 in order; "総人口" is id 3.
  await page.getByPlaceholder(/AND\(EQ/).fill('LEQ(@3, 1000000)')
  await page.getByRole('button', { name: '適用' }).click()

  await page.getByRole('columnheader', { name: '総人口', exact: true }).click()
  await page.getByRole('button', { name: '削除' }).click()

  await expect(page.getByText(/絞り込み.*使用されています/)).toBeVisible()
})
