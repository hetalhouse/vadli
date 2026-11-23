import { expect, test } from '@playwright/test'

const tile = '.vadli-tile'

test('tiles drift', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator(tile).first()).toBeVisible()
  const before = await page.locator(tile).first().evaluate((e) => (e as HTMLElement).style.transform)
  await page.waitForTimeout(1200)
  const after = await page.locator(tile).first().evaluate((e) => (e as HTMLElement).style.transform)
  expect(after).not.toBe(before)
  expect(await page.locator(tile).count()).toBeLessThanOrEqual(48)
})

test('click expands in place, freezes the cloud, Esc collapses', async ({ page }) => {
  await page.goto('/')
  await page.locator(tile).first().waitFor()
  const id = await page.locator(tile).last().evaluate((e) => (e as HTMLElement).dataset.id!)
  await page.evaluate((id) => (document.querySelector(`[data-id="${id}"]`) as HTMLElement).click(), id)
  const open = page.locator('.vadli-tile.is-open')
  await expect(open).toHaveCount(1)
  await expect(page).toHaveURL(new RegExp(`#m=${id}$`))
  const box = (await open.boundingBox())!
  const vp = page.viewportSize()!
  await page.waitForTimeout(450)
  const settled = (await open.boundingBox())!
  expect(settled.width).toBeGreaterThan(box.width - 1)
  expect(settled.x + settled.width).toBeLessThanOrEqual(vp.width)
  // cloud is paused while open
  const other = page.locator(`${tile}:not(.is-open)`).first()
  const t0 = await other.evaluate((e) => (e as HTMLElement).style.transform)
  await page.waitForTimeout(500)
  expect(await other.evaluate((e) => (e as HTMLElement).style.transform)).toBe(t0)
  await page.keyboard.press('Escape')
  await expect(open).toHaveCount(0)
  await expect(page).not.toHaveURL(/#m=/)
})

test('share copies a link that reopens the same item directly', async ({ page, context }) => {
  await page.goto('/')
  const id = await page.locator(tile).first().evaluate((e) => (e as HTMLElement).dataset.id!)
  await page.evaluate((id) => (document.querySelector(`[data-id="${id}"]`) as HTMLElement).click(), id)
  await page.getByRole('button', { name: 'Share' }).click()
  await expect(page.locator('.vadli-note')).toHaveText('Link copied')
  const link = await page.evaluate(() => navigator.clipboard.readText())
  expect(link).toContain(`#m=${id}`)

  const friend = await context.newPage()
  await friend.goto(link)
  await expect(friend.locator('.vadli-tile.is-open')).toHaveAttribute('data-id', id)
  await expect(friend.locator('.vadli-title')).toHaveText(/Sample \d+/)
})

test('browser back collapses an open item', async ({ page }) => {
  await page.goto('/')
  await page.locator(tile).first().waitFor()
  await page.evaluate(() => (document.querySelector('.vadli-tile') as HTMLElement).click())
  await expect(page.locator('.vadli-tile.is-open')).toHaveCount(1)
  await page.goBack()
  await expect(page.locator('.vadli-tile.is-open')).toHaveCount(0)
})

test('videos get a play badge, a controllable player, and stop on close', async ({ page }) => {
  await page.goto('/?videos')
  const video = page.locator('.vadli-tile.is-video').first()
  await expect(video).toBeVisible()
  await expect(video.locator('.vadli-play')).toBeVisible()
  const id = await video.evaluate((e) => (e as HTMLElement).dataset.id!)
  await page.evaluate((id) => (document.querySelector(`[data-id="${id}"]`) as HTMLElement).click(), id)
  const open = page.locator('.vadli-tile.is-open')
  await expect(open.locator('video[controls]')).toHaveCount(1)
  // source 404s -> falls back to Drive's embedded player
  await expect(open.locator('iframe.vadli-video')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(open.locator('.vadli-video')).toHaveCount(0)
  await expect(video.locator('.vadli-play')).toBeVisible()
})

test('no horizontal page scroll at phone and desktop widths', async ({ page }) => {
  for (const width of [360, 1600]) {
    await page.setViewportSize({ width, height: 800 })
    await page.goto('/')
    await page.locator(tile).first().waitFor()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
})
