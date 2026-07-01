import { test, expect } from '@playwright/test'

const MOCK_SETTINGS = JSON.stringify({ provider: 'mock', apiKey: '' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript((settings) => {
    localStorage.setItem('ttb-ocr-settings', settings)
  }, MOCK_SETTINGS)
})

test('queue screen loads with seeded applications', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Verification Queue' })).toBeVisible()
  await expect(page.getByText('Old Tom Distillery').first()).toBeVisible()
})

test('add mock application increases the pending count', async ({ page }) => {
  await page.goto('/')
  const pendingBtn = page.getByRole('button', { name: /Run pre-analysis now/ })
  const before = await pendingBtn.textContent()
  await page.getByRole('button', { name: '+ Add mock application' }).click()
  await expect(pendingBtn).not.toHaveText(before ?? '')
})

test('run pre-analysis clears the pending count', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Run pre-analysis now/ }).click()
  await expect(page.getByText(/Run pre-analysis now \(0 pending\)/)).toBeVisible({ timeout: 15000 })
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
  const overrideButtons = page.getByRole('button', { name: 'Override', exact: true })
  await expect(overrideButtons.first()).toBeVisible({ timeout: 15000 })
  const count = await overrideButtons.count()
  for (let i = 0; i < count; i++) {
    await page.getByRole('button', { name: 'Override', exact: true }).first().click()
    await page.getByPlaceholder('Reason for overriding this mismatch…').fill('Confirmed acceptable on manual review')
    await page.getByRole('button', { name: 'Save override' }).click()
  }
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
