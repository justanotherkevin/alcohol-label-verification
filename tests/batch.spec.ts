import { test, expect } from '@playwright/test'
import path from 'path'

const MOCK_SETTINGS = JSON.stringify({ provider: 'mock', apiKey: '' })

const VALID_CSV = [
  'filename,brandName,classType,abv,netContents,bottler,countryOfOrigin,governmentWarning',
  'abc-distillery.png,ABC Distillery,Bourbon Whiskey,40% ABV,750 mL,ABC Distillery Louisville KY,USA,GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
  'malt-hop-brewery.png,Hop City Brewing,Malt Beverage,5% ABV,355 mL,Hop City Brewing Co Atlanta GA,USA,GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.',
].join('\n')

const INVALID_CSV = 'name,type\nfoo,bar'

test.beforeEach(async ({ page }) => {
  await page.addInitScript((settings) => {
    localStorage.setItem('ttb-ocr-settings', settings)
  }, MOCK_SETTINGS)
})

test('batch page loads with upload zones', async ({ page }) => {
  await page.goto('/batch')
  await expect(page.getByText(/Batch Verification/i)).toBeVisible()
  await expect(page.getByRole('button', { name: /Verify All/i })).toBeVisible()
})

test('invalid CSV shows error message', async ({ page }) => {
  await page.goto('/batch')

  const csvBlob = Buffer.from(INVALID_CSV)
  await page.locator('input[accept=".csv"]').setInputFiles({
    name: 'labels.csv',
    mimeType: 'text/csv',
    buffer: csvBlob,
  })

  await expect(page.getByText(/missing required columns/i)).toBeVisible({ timeout: 5000 })
})

test('valid CSV + images enables Verify All and streams results', async ({ page }) => {
  await page.goto('/batch')

  const csvBlob = Buffer.from(VALID_CSV)
  await page.locator('input[accept=".csv"]').setInputFiles({
    name: 'labels.csv',
    mimeType: 'text/csv',
    buffer: csvBlob,
  })

  await page.locator('[data-testid="images-input"]').setInputFiles([
    path.join('tests', 'mocks', 'abc-distillery.png'),
    path.join('tests', 'mocks', 'malt-hop-brewery.png'),
  ])

  await page.getByRole('button', { name: /Verify All/i }).click()

  // Wait for both result cards (filename appears in result card and notification panel)
  await expect(page.getByTestId('result-card-0')).toBeVisible({ timeout: 15000 })
  await expect(page.getByTestId('result-card-1')).toBeVisible({ timeout: 15000 })
})
