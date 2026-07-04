import { test, expect } from '@playwright/test'

const MOCK_SETTINGS = JSON.stringify({ provider: 'mock', apiKey: '' })
const MOCK_SPECIALIST = JSON.stringify({ id: 'jenny-park', name: 'Jenny Park', role: 'Junior Compliance Agent' })

// Three seeded, already-analyzed applications that are each guaranteed to have
// at least one flagged field, so a reject can always cite a field without
// needing a manual override first.
const BATCH_IDS = ['demo-TTB-2026-1001', 'demo-TTB-2026-1002', 'demo-TTB-2026-1003']

test.beforeEach(async ({ page, request }) => {
  // Reset to known seed data so the 3 target applications exist, are
  // unresolved, and the audit log starts empty.
  await request.delete('/api/queue/reset')
  await page.addInitScript(({ settings, specialist }) => {
    localStorage.setItem('ttb-ocr-settings', settings)
    localStorage.setItem('ttb-specialist', specialist)
  }, { settings: MOCK_SETTINGS, specialist: MOCK_SPECIALIST })
})

test('batch review: select 3, reject each in sequence, auto-advance, return home, and record in audit', async ({ page }) => {
  await page.goto('/')

  for (const id of BATCH_IDS) {
    await page.getByRole('checkbox', { name: `Select ${id}` }).check()
  }
  await page.getByRole('button', { name: /Start batch review \(3\)/ }).click()

  // Batch kicked off — land on the first selected application with a `batch` param.
  await expect(page).toHaveURL(/\/queue\/demo-TTB-2026-\d+\?batch=/)
  const batchParam = new URL(page.url()).searchParams.get('batch')
  const orderedIds = batchParam?.split(',') ?? []
  expect([...orderedIds].sort()).toEqual([...BATCH_IDS].sort())

  for (let i = 0; i < orderedIds.length; i++) {
    const id = orderedIds[i]
    await expect(page).toHaveURL(new RegExp(`/queue/${id}\\?batch=`))
    await expect(
      page.getByText(`Batch review — application ${i + 1} of ${orderedIds.length}`)
    ).toBeVisible()

    await page.getByRole('button', { name: 'Reject', exact: true }).click()
    const noteInput = page.getByPlaceholder('Rejection note (required)…')
    await expect(noteInput).toBeVisible()
    await page.getByRole('checkbox').first().check()
    await noteInput.fill('Government warning is not compliant')
    const confirmBtn = page.getByRole('button', { name: 'Confirm Reject' })
    await expect(confirmBtn).toBeEnabled()
    await confirmBtn.click()

    if (i < orderedIds.length - 1) {
      // 4. Auto-advances to the next application without returning home.
      await expect(page).toHaveURL(new RegExp(`/queue/${orderedIds[i + 1]}\\?batch=`))
    } else {
      // 5. Final application returns to the dashboard.
      await expect(page).toHaveURL('/')
    }
  }

  // 6. Selected applications are no longer in the queue (they're resolved).
  const queueRes = await page.request.get('/api/queue?page=1&pageSize=100')
  const queueData = (await queueRes.json()) as { items: { id: string }[] }
  const queueIds = queueData.items.map((item) => item.id)
  for (const id of BATCH_IDS) {
    expect(queueIds).not.toContain(id)
  }

  // 7. Processed applications show up in the audit log.
  await page.goto('/audit')
  for (const id of BATCH_IDS) {
    await expect(page.getByRole('cell', { name: id })).toBeVisible()
  }
})
