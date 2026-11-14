import { test, expect } from '@playwright/test'

test('a ranking page shows its title, description, the data it uses, and the source', async ({ page }) => {
  await page.goto('/rankings/all/density')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  await expect(page.getByRole('heading', { level: 1, name: '全国の自治体の人口密度ランキング' })).toBeVisible()
  await expect(page.getByText('人口密度（人/km²）の高い順に並べたランキングです')).toBeVisible()
  // Density uses population and area — and only those.
  await expect(page.getByRole('button', { name: /^人口\s*住民基本台帳/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^面積\s*国土地理院/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /^家賃/ })).toHaveCount(0)
  await expect(page.getByText('出典：', { exact: true }).locator('..')).toContainText('住民基本台帳')
})

test('numbers have thousands separators and the ranked column sits right after the name', async ({ page }) => {
  await page.goto('/rankings/all/density')
  const headers = await page.locator('thead th').allInnerTexts()
  expect(headers.slice(1, 3).map(h => h.replace(/[▼▲⇅\s]/g, ''))).toEqual(['自治体名', '人口密度(人/km²)'])
  await expect(page.locator('tbody tr').first().locator('td').nth(2)).toHaveText(/^\d{1,3}(,\d{3})+(\.\d+)?$/)
})

test('the data selection is kept in the URL and survives a reload', async ({ page }) => {
  await page.goto('/rankings/all/density')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  await page.getByRole('button', { name: /^面積\s*国土地理院/ }).click()
  await page.locator('select').filter({ has: page.locator('option', { hasText: '2024-01-01' }) }).last().selectOption({ label: '2024-01-01' })
  await page.getByRole('button', { name: '適用' }).click()

  await expect(page).toHaveURL(/area=2024-01-01/)
  await expect(page.getByRole('button', { name: /^面積\s*.*2024-01-01/ })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: /^面積\s*.*2024-01-01/ })).toBeVisible()
})

test('a header sort button sorts by that column, and again flips the direction', async ({ page }) => {
  await page.goto('/explore')
  await expect(page.locator('tbody tr').first()).toBeVisible()

  await page.getByRole('button', { name: '総人口で並べ替え' }).click()
  await expect(page.getByRole('button', { name: '並べ替え', exact: true })).toContainText('並び：総人口 ↓')
  await expect(page.locator('tbody tr').first().locator('td').nth(1)).toHaveText('横浜市')

  await page.getByRole('button', { name: '総人口で並べ替え' }).click()
  await expect(page.getByRole('button', { name: '並べ替え', exact: true })).toContainText('並び：総人口 ↑')
})

test.describe('on a phone', () => {
  // iPhone 13's screen on the configured (chromium) browser.
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })

  test('the view switch, sort and filter are on the page (not hidden in the menu), and the name column stays put when scrolling sideways', async ({ page }) => {
    await page.goto('/rankings/all/density')
    await expect(page.locator('tbody tr').first()).toBeVisible()

    await expect(page.getByRole('tab', { name: '地図', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '並べ替え', exact: true })).toBeVisible()

    const name = page.locator('tbody tr').first().locator('td').nth(1)
    const before = await name.boundingBox()
    await page.locator('main').evaluate(el => el.scrollBy(300, 0))
    await expect(async () => {
      const scrolled = await page.locator('main').evaluate(el => el.scrollLeft)
      expect(scrolled).toBeGreaterThan(0)
    }).toPass()
    // Pinned: the rank column at the left edge, the name right after it.
    const rank = await page.locator('tbody tr').first().locator('td').first().boundingBox()
    const after = await name.boundingBox()
    expect(rank!.x).toBeCloseTo(0, 0)
    expect(after!.x).toBeCloseTo(rank!.x + rank!.width, 0)
    expect(after!.x).toBeLessThanOrEqual(before!.x)
  })
})
