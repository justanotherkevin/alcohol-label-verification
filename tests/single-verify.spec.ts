import { test, expect } from '@playwright/test'
import path from 'path'

const MOCK_SETTINGS = JSON.stringify({ provider: 'mock', apiKey: '' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript((settings) => {
    localStorage.setItem('ttb-ocr-settings', settings)
  }, MOCK_SETTINGS)
})

test('verify label button is disabled until image is uploaded', async ({ page }) => {
  await page.goto('/verify')
  const btn = page.getByRole('button', { name: 'Verify Label' })
  await expect(btn).toBeDisabled()
})

test('uploading image shows preview', async ({ page }) => {
  await page.goto('/verify')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(path.join('tests', 'mocks', 'label_1.jpg'))
  await expect(page.locator('img[alt="Label preview"]')).toBeVisible()
})

test('after upload, verify label button is enabled', async ({ page }) => {
  await page.goto('/verify')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(path.join('tests', 'mocks', 'label_1.jpg'))
  await expect(page.getByRole('button', { name: 'Verify Label' })).toBeEnabled()
})

test('verify with mock provider shows result cards', async ({ page }) => {
  await page.goto('/verify')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(path.join('tests', 'mocks', 'label_1.jpg'))
  await page.getByRole('button', { name: 'Verify Label' }).click()
  await expect(page.getByText('Verification Results')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/PASSED|FAILED/)).toBeVisible()
})

test('result shows all 7 field rows', async ({ page }) => {
  await page.goto('/verify')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(path.join('tests', 'mocks', 'label_1.jpg'))
  await page.getByRole('button', { name: 'Verify Label' }).click()
  await expect(page.getByText('Verification Results')).toBeVisible({ timeout: 10000 })
  // Results section has exactly 7 field rows
  await expect(page.locator('.space-y-3 > div')).toHaveCount(7)
})

test('classType field row shows Regulatory subsection', async ({ page }) => {
  await page.goto('/verify')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(path.join('tests', 'mocks', 'label_1.jpg'))
  await page.getByRole('button', { name: 'Verify Label' }).click()
  await expect(page.getByText('Verification Results')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Regulatory').first()).toBeVisible()
})

test('clicking a field row selects it (ring highlight)', async ({ page }) => {
  await page.goto('/verify')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(path.join('tests', 'mocks', 'label_1.jpg'))
  await page.getByRole('button', { name: 'Verify Label' }).click()
  await expect(page.getByText('Verification Results')).toBeVisible({ timeout: 10000 })

  // Click the first field row
  const firstFieldRow = page.locator('.space-y-3 > div').first()
  await firstFieldRow.click()
  await expect(firstFieldRow).toHaveClass(/ring-2/)
})

test('clicking the same field row again deselects it', async ({ page }) => {
  await page.goto('/verify')
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(path.join('tests', 'mocks', 'label_1.jpg'))
  await page.getByRole('button', { name: 'Verify Label' }).click()
  await expect(page.getByText('Verification Results')).toBeVisible({ timeout: 10000 })

  const firstFieldRow = page.locator('.space-y-3 > div').first()
  await firstFieldRow.click()
  await expect(firstFieldRow).toHaveClass(/ring-2/)
  await firstFieldRow.click()
  await expect(firstFieldRow).not.toHaveClass(/ring-2/)
})
