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

test("the home carousel steps through picked rankings, each map leading to its ranking's map view", async ({ page }) => {
  await page.goto('/')
  const carousel = page.getByRole('region', { name: 'ピックアップ' })
  await expect(carousel.getByText('1 / 8')).toBeVisible()
  await carousel.getByRole('button', { name: '次へ' }).click()
  await expect(carousel.getByText('2 / 8')).toBeVisible()
  await carousel.getByRole('tab', { name: /年下の彼女/ }).click()
  await expect(carousel.getByText('6 / 8')).toBeVisible()
  await carousel.getByRole('link', { name: /年下の彼女を探すなら、ライバルは何人？（地図で見る）/ }).click()
  await expect(page).toHaveURL(/\/rankings\/all\/love-competition-men\?map=@1$/)
})

test('the home page shows the brand in its hero, and in the bar only after scrolling', async ({ page }) => {
  await page.goto('/')
  const barBrand = page.getByRole('banner').getByRole('link', { name: /まちくらべ/ })
  await expect(barBrand).toHaveCount(0)
  await page.mouse.wheel(0, 600)
  await expect(barBrand).toBeVisible()
})

test('a prefecture page lists its municipalities and its rankings', async ({ page }) => {
  await page.goto('/rankings/gifu')
  await expect(page.getByRole('heading', { level: 1, name: '岐阜県' })).toBeVisible()
  // The list is folded away under the rankings.
  await page.getByRole('heading', { name: /^岐阜県の市区町村一覧/ }).click()
  const list = page.getByTestId('pref-municipalities')
  await expect(list.getByRole('link', { name: '岐阜市', exact: true })).toBeVisible()
  await expect(list.getByRole('link')).toHaveCount(42)
  await page.getByRole('link', { name: '人口密度', exact: true }).click()
  await expect(page).toHaveURL(/\/rankings\/gifu\/density$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('岐阜県の自治体の人口密度ランキング')
})

test('a prefecture without villages offers no village ranking', async ({ page }) => {
  await page.goto('/rankings/hyogo')
  await expect(page.getByRole('link', { name: '町の人口', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '村の人口', exact: true })).toHaveCount(0)
})

test("a prefecture page's headline figures lead to their rankings", async ({ page }) => {
  await page.goto('/rankings/shimane')
  await page.getByTestId('pref-figures').getByRole('link', { name: /^人口増減率/ }).click()
  await expect(page).toHaveURL(/\/rankings\/shimane\/population-change$/)
})

test('the carousel moves on by itself, and its pause button stops that', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  const carousel = page.getByRole('region', { name: 'ピックアップ' })
  await expect(carousel.getByText('1 / 8')).toBeVisible()
  await page.mouse.move(0, 0)
  await page.clock.fastForward(21_000)
  await expect(carousel.getByText('2 / 8')).toBeVisible()
  await carousel.getByRole('button', { name: '自動で進めるのを止める' }).click()
  await page.mouse.move(0, 0)
  await page.clock.fastForward(60_000)
  await expect(carousel.getByText('2 / 8')).toBeVisible()
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('a swipe moves the carousel to the next slide', async ({ page }) => {
    await page.goto('/')
    const carousel = page.getByRole('region', { name: 'ピックアップ' })
    await expect(carousel.getByText('1 / 8')).toBeVisible()
    const box = (await carousel.getByRole('heading', { level: 3 }).first().boundingBox())!
    const y = Math.round(box.y + 150)
    const cdp = await page.context().newCDPSession(page)
    // A finger dragged right to left across the map.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 320, y }] })
    for (let x = 300; x >= 60; x -= 20) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
      await page.waitForTimeout(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(carousel.getByText('2 / 8')).toBeVisible()
    await expect(carousel.getByRole('button', { name: '次へ' })).toBeVisible()
  })
})
