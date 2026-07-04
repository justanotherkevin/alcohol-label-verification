import { test, expect } from '@playwright/test'

const MOCK_SETTINGS = JSON.stringify({ provider: 'mock', apiKey: '' })
const MOCK_SPECIALIST = JSON.stringify({ id: 'jenny-park', name: 'Jenny Park', role: 'Junior Compliance Agent' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ settings, specialist }) => {
    localStorage.setItem('ttb-ocr-settings', settings)
    localStorage.setItem('ttb-specialist', specialist)
  }, { settings: MOCK_SETTINGS, specialist: MOCK_SPECIALIST })
})

async function overrideAllFlaggedFields(page: import('@playwright/test').Page) {
  const overrideButtons = page.getByRole('button', { name: 'Override', exact: true })
  await expect(overrideButtons.first()).toBeVisible({ timeout: 15000 })
  const count = await overrideButtons.count()
  for (let i = 0; i < count; i++) {
    await page.getByRole('button', { name: 'Override', exact: true }).first().click()
    const modal = page.locator('div', { hasText: 'Override field' }).last()
    await modal.getByPlaceholder('Reason for this override…').fill('Confirmed acceptable on manual review')
    await modal.getByRole('button', { name: 'Approve', exact: true }).click()
  }
}

test('queue screen loads with seeded applications', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Verification Queue' })).toBeVisible()
  // Avoid demo-TTB-2026-1001/1002/1003 — batch-review.spec.ts resolves those,
  // which removes them from the active queue by the time this test runs.
  await expect(page.getByText('12345 IMPORTS').first()).toBeVisible()
})

test('add mock application increases the pending count', async ({ page }) => {
  await page.goto('/')
  const pendingStat = page.locator('p:has-text("Awaiting analysis") + p')
  const before = await pendingStat.textContent()

  await page.goto('/settings')
  await page.getByRole('button', { name: '+ Add mock application' }).click()

  await page.goto('/')
  await expect(pendingStat).not.toHaveText(before ?? '')
})

test('run pre-analysis clears the pending count', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: /Run pre-analysis now/ }).click()
  await expect(page.getByRole('button', { name: /Run pre-analysis now \(0 pending\)/ })).toBeVisible({ timeout: 15000 })
})

test('opening a flagged application shows field rows with an Override option', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Review →' }).first().click()
  await expect(page.getByRole('button', { name: 'Override' }).first()).toBeVisible()
})

test('approve is disabled until all flagged fields are overridden', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Review →' }).first().click()
  await expect(page.getByRole('button', { name: 'Approve' })).toBeDisabled()
})

test('overriding all flagged fields enables Approve', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Review →' }).first().click()
  await overrideAllFlaggedFields(page)
  await expect(page.getByRole('button', { name: 'Approve' })).toBeEnabled()
})

test('reject requires citing a field and a note', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Review →' }).first().click()
  await page.getByRole('button', { name: 'Reject' }).click()
  const confirmBtn = page.getByRole('button', { name: 'Confirm Reject' })
  await expect(confirmBtn).toBeDisabled()
  await page.getByRole('checkbox').first().check()
  await expect(confirmBtn).toBeDisabled()
  await page.getByPlaceholder('Rejection note (required)…').fill('Government warning is not compliant')
  await expect(confirmBtn).toBeEnabled()
})

test('approving a resolved application returns to the queue and removes its row', async ({ page }) => {
  await page.goto('/')
  const firstRow = page.locator('tbody tr').first()
  const brandName = (await firstRow.locator('td').nth(1).textContent())?.trim()
  await firstRow.getByRole('link', { name: 'Review →' }).click()

  await overrideAllFlaggedFields(page)
  await expect(page.getByRole('button', { name: 'Approve' })).toBeEnabled()
  await page.getByRole('button', { name: 'Approve' }).click()

  await expect(page).toHaveURL('/')
  if (brandName) {
    await expect(page.getByText(brandName).first()).not.toBeVisible()
  }
})

test('rejecting a resolved application returns to the queue and removes its row', async ({ page }) => {
  await page.goto('/')
  const firstRow = page.locator('tbody tr').first()
  const brandName = (await firstRow.locator('td').nth(1).textContent())?.trim()
  await firstRow.getByRole('link', { name: 'Review →' }).click()

  await page.getByRole('button', { name: 'Reject' }).click()
  await page.getByRole('checkbox').first().check()
  await page.getByPlaceholder('Rejection note (required)…').fill('Government warning is not compliant')
  await page.getByRole('button', { name: 'Confirm Reject' }).click()

  await expect(page).toHaveURL('/')
  if (brandName) {
    await expect(page.getByText(brandName).first()).not.toBeVisible()
  }
})
