import { test, expect } from '@playwright/test'

// What the selected data provides decides which variables an expression may
// use (src/data/schema.ts): 国勢調査 has totals only, no 世帯数 or age brackets.
const state = (extra: { label: string; expression: string }[]) => encodeURIComponent(JSON.stringify({
  columns: [{ id: 0, label: '自治体名', expression: '$kanji' }, ...extra.map((c, i) => ({ id: i + 1, ...c }))],
  filterExpression: '', sortExpression: '', sortDirection: 'desc',
}))

test('with 国勢調査 selected, the editor rejects a variable it does not have', async ({ page }) => {
  await page.goto(`/explore?pop=kokusei:2025&s=${state([{ label: '総人口', expression: '#totalpop' }])}`)
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await page.getByRole('columnheader', { name: '+', exact: true }).click()
  const input = page.getByPlaceholder(/#inc_mov - /)
  await input.fill('#elderly_total / #totalpop')
  await expect(page.getByText(/には #elderly_total の計算に使う #total65_69 がありません/)).toBeVisible()
  await input.fill('#totalpop / #area')
  await expect(page.getByText('✓ 数値の式として有効です')).toBeVisible()
})

test('the data dialog does not offer an edition lacking a variable the table uses', async ({ page }) => {
  await page.goto(`/explore?s=${state([{ label: '世帯数', expression: '#setai' }])}`)
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await page.getByText('データの選択', { exact: true }).first().click()
  const dialog = page.getByRole('dialog', { name: 'データの選択' })
  await expect(dialog.getByRole('radio').nth(1)).toBeDisabled()
  await expect(dialog.getByText('使用中の #setai がありません')).toBeVisible()
})

test('a URL asking for an edition the table cannot use falls back to one it can', async ({ page }) => {
  await page.goto(`/explore?pop=kokusei:2025&s=${state([{ label: '世帯数', expression: '#setai' }])}`)
  await expect(page.locator('tbody tr').first()).toBeVisible()
  await expect(page.getByText(/住民基本台帳/).first()).toBeVisible()
  await expect(page.getByText(/国勢調査/)).toHaveCount(0)
})
