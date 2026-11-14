import { test, expect } from '@playwright/test'

test('the home page searches municipalities by name or reading and opens the chosen one', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'まちくらべ' })).toBeVisible()
  const box = page.getByRole('combobox', { name: '市区町村名で探す' })
  await box.fill('ながれやま')
  await expect(page.getByRole('option').first()).toContainText('流山市')
  await box.press('Enter')
  await expect(page).toHaveURL(/\/m\/12220$/)
})

test('the home tile map shows every prefecture and leads to its page', async ({ page }) => {
  await page.goto('/')
  const tiles = page.getByRole('list', { name: '都道府県の人口増減率' }).getByRole('listitem')
  await expect(tiles).toHaveCount(47)
  // Each tile spells out its value (color is not the only cue).
  await expect(tiles.filter({ hasText: '東京' })).toHaveAttribute('aria-label', /^東京都 [+-]\d+\.\d%$/)
  await tiles.filter({ hasText: '岐阜' }).click()
  await expect(page).toHaveURL(/\/rankings\/gifu$/)
})

test('a prefecture page lists its municipalities and its rankings', async ({ page }) => {
  await page.goto('/rankings/gifu')
  await expect(page.getByRole('heading', { level: 1, name: '岐阜県' })).toBeVisible()
  const list = page.getByTestId('pref-municipalities')
  await expect(list.getByRole('link', { name: '岐阜市', exact: true })).toBeVisible()
  await expect(list.getByRole('link')).toHaveCount(42)
  await page.getByRole('link', { name: '人口密度', exact: true }).click()
  await expect(page).toHaveURL(/\/rankings\/gifu\/density$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('岐阜県の自治体の人口密度ランキング')
})

test('a prefecture without villages offers no village ranking', async ({ page }) => {
  await page.goto('/rankings/hyogo')
  await expect(page.getByTestId('pref-municipalities')).toBeVisible()
  await expect(page.getByRole('link', { name: '町の人口', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '村の人口', exact: true })).toHaveCount(0)
})
