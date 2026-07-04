import { test, expect } from '@playwright/test'

const MOCK_SPECIALIST = JSON.stringify({ id: 'jenny-park', name: 'Jenny Park', role: 'Junior Compliance Agent' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript((specialist) => {
    localStorage.setItem('ttb-specialist', specialist)
  }, MOCK_SPECIALIST)
})

test('settings page loads with all 5 provider options', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByText('Tesseract (Local)')).toBeVisible()
  await expect(page.getByText('Claude Sonnet 4.6')).toBeVisible()
  await expect(page.getByText('Gemini 2.0 Flash')).toBeVisible()
  await expect(page.getByText('GPT-4o')).toBeVisible()
  await expect(page.getByText('Mock (Testing)')).toBeVisible()
})

test('selecting Mock and saving updates nav badge after navigation', async ({ page }) => {
  await page.goto('/settings')
  await page.getByText('Mock (Testing)').click()
  await page.getByRole('button', { name: 'Save Settings' }).click()
  await expect(page.getByText('Saved!')).toBeVisible()
  // Sidebar re-reads localStorage on pathname change
  await page.goto('/')
  await expect(page.locator('p:has-text("OCR Engine") + p')).toHaveText('Mock')
})

test('API key input hidden for Tesseract provider', async ({ page }) => {
  await page.goto('/settings')
  await page.getByText('Tesseract (Local)').click()
  await expect(page.locator('input[type="password"]')).not.toBeVisible()
})

test('API key input shown when Claude is selected', async ({ page }) => {
  await page.goto('/settings')
  await page.getByText('Claude Sonnet 4.6').click()
  await expect(page.locator('input[type="password"]')).toBeVisible()
})
