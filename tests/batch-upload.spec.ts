import { test, expect } from '@playwright/test'

const MOCK_SETTINGS = JSON.stringify({ provider: 'mock', apiKey: '' })
const MOCK_SPECIALIST = JSON.stringify({ id: 'jenny-park', name: 'Jenny Park', role: 'Junior Compliance Agent' })

// The mock OCR provider always returns a fixed extraction whose government
// warning is title-case (see lib/ocr/mock.ts) — it never strictly matches
// REQUIRED_GOVERNMENT_WARNING, so every row processed with `mock` is
// guaranteed to be flagged, never clean-pass. That's fine for exercising the
// flagged-row → queue → resolve → export path end to end; the clean-pass
// auto-resolve path is covered instead by the unit test for
// `classifyAnalyzedRow` (lib/batch/runner.test.ts), since reliably producing
// a genuinely clean row would require a differently-behaved fixture/provider.
function buildCsv(rows: { brand: string; front: string; back: string }[]): string {
  const header =
    'brand_name,class_type,abv,net_contents,bottler_info,country_of_origin,govt_warning,front_image_url,back_image_url'
  const lines = rows.map(
    (r) =>
      `${r.brand},Kentucky Straight Bourbon Whiskey,40% ABV,750 mL,Test Bottler,United States,"GOVERNMENT WARNING: test",${r.front},${r.back}`
  )
  return [header, ...lines].join('\n')
}

test.beforeEach(async ({ page, request }) => {
  await request.delete('/api/queue/reset')
  await page.addInitScript(
    ({ settings, specialist }) => {
      localStorage.setItem('ttb-ocr-settings', settings)
      localStorage.setItem('ttb-specialist', specialist)
    },
    { settings: MOCK_SETTINGS, specialist: MOCK_SPECIALIST }
  )
})

test('batch upload: CSV rows process, flagged rows enter the queue, export reflects resolved state', async ({
  page,
}) => {
  await page.goto('/batch')

  const csv = buildCsv([
    {
      brand: "Stone's Throw",
      front: 'http://localhost:3000/demo-labels/hollow-creek.jpg',
      back: 'http://localhost:3000/demo-labels/hollow-creek.jpg',
    },
    {
      brand: 'Desert Luna',
      front: 'http://localhost:3000/demo-labels/abc-distillery.png',
      back: '',
    },
  ])

  await page.locator('input[type="file"]').setInputFiles({
    name: 'batch.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  })
  await page.getByRole('button', { name: 'Upload and process' }).click()

  await expect(page).toHaveURL(/\/batch\?id=/)
  const batchId = new URL(page.url()).searchParams.get('id')
  expect(batchId).toBeTruthy()

  await expect(page.getByText('Processing complete.')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('2 pending review')).toBeVisible()

  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(page.getByText('Needs review')).toHaveCount(2)

  // Both rows are flagged (mock provider always fails the govt-warning
  // strict match), so both should show up in the main specialist queue.
  const queueRes = await page.request.get('/api/queue?page=1&pageSize=100')
  const queueData = (await queueRes.json()) as { items: { id: string; brandName: string }[] }
  const queueBrands = queueData.items.map((item) => item.brandName)
  expect(queueBrands).toContain("Stone's Throw")
  expect(queueBrands).toContain('Desert Luna')

  // Resolve one flagged row through the existing Flow 1 review UI.
  await page.getByRole('link', { name: 'Review in queue →' }).first().click()
  await expect(page).toHaveURL(/\/queue\//)
  await page.getByRole('button', { name: 'Next field →' }).click()
  await page.getByRole('button', { name: '✗ Reject', exact: true }).click()
  await page.getByRole('button', { name: 'Skip to summary' }).click()
  await page.getByRole('button', { name: '✗ Deny' }).click()
  const confirmBtn = page.getByRole('button', { name: 'Confirm Deny' })
  await expect(confirmBtn).toBeDisabled()
  await page.getByPlaceholder('Rejection note (required)…').fill('Government warning is not compliant')
  await expect(confirmBtn).toBeEnabled()
  const [resolveRes] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/resolve') && res.request().method() === 'POST'),
    confirmBtn.click(),
  ])
  expect(resolveRes.ok()).toBeTruthy()

  const exportRes = await page.request.get(`/api/batch/${batchId}/export`)
  expect(exportRes.ok()).toBeTruthy()
  const exportCsv = await exportRes.text()
  expect(exportCsv).toContain('Rejected')
  expect(exportCsv).toContain('Pending Review')
})

test('batch upload: "Start batch review" launches a review session covering the remaining flagged rows', async ({
  page,
}) => {
  await page.goto('/batch')

  const csv = buildCsv([
    {
      brand: "Stone's Throw",
      front: 'http://localhost:3000/demo-labels/hollow-creek.jpg',
      back: '',
    },
    {
      brand: 'Desert Luna',
      front: 'http://localhost:3000/demo-labels/abc-distillery.png',
      back: '',
    },
  ])

  await page.locator('input[type="file"]').setInputFiles({
    name: 'batch.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  })
  await page.getByRole('button', { name: 'Upload and process' }).click()
  await expect(page).toHaveURL(/\/batch\?id=/)
  await expect(page.getByText('Processing complete.')).toBeVisible({ timeout: 30_000 })

  const reviewButton = page.getByRole('button', { name: 'Start batch review (2)' })
  await expect(reviewButton).toBeVisible()
  await reviewButton.click()

  await expect(page).toHaveURL(/\/queue\/.+\?batch=/)
  const batchParam = new URL(page.url()).searchParams.get('batch')
  expect(batchParam?.split(',')).toHaveLength(2)
  await expect(page.getByText('Batch review — application 1 of 2')).toBeVisible()
})
