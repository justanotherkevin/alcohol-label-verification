import { test, expect } from '@playwright/test'

const MOCK_SETTINGS = JSON.stringify({ provider: 'mock', apiKey: '' })
const MOCK_SPECIALIST = JSON.stringify({ id: 'jenny-park', name: 'Jenny Park', role: 'Junior Compliance Agent' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ settings, specialist }) => {
    localStorage.setItem('ttb-ocr-settings', settings)
    localStorage.setItem('ttb-specialist', specialist)
  }, { settings: MOCK_SETTINGS, specialist: MOCK_SPECIALIST })
})

test('re-run OCR forwards the configured provider instead of defaulting to tesseract', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Review', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Re-run OCR' })).toBeVisible()

  // Switch the configured provider after landing on the page, mirroring a user
  // who changes Settings then returns to re-run OCR on an already-analyzed app.
  await page.evaluate(() => {
    localStorage.setItem(
      'ttb-ocr-settings',
      JSON.stringify({ provider: 'google-vision', apiKey: 'test-key' }),
    )
  })

  let providerHeader: string | null = null
  await page.route('**/api/queue/analyze', async (route) => {
    providerHeader = await route.request().headerValue('x-ocr-provider')
    await route.fulfill({ json: { analyzedIds: [] } })
  })

  await page.getByRole('button', { name: 'Re-run OCR' }).click()
  await expect.poll(() => providerHeader).toBe('google-vision')
})
