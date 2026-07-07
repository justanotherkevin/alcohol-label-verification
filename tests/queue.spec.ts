import { test, expect } from '@playwright/test'

const MOCK_SETTINGS = JSON.stringify({ provider: 'mock', apiKey: '' })
const MOCK_SPECIALIST = JSON.stringify({ id: 'jenny-park', name: 'Jenny Park', role: 'Junior Compliance Agent' })

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ settings, specialist }) => {
    localStorage.setItem('ttb-ocr-settings', settings)
    localStorage.setItem('ttb-specialist', specialist)
  }, { settings: MOCK_SETTINGS, specialist: MOCK_SPECIALIST })
})

async function leaveSummary(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Next field →' }).click()
}

async function acceptAllFlaggedFields(page: import('@playwright/test').Page) {
  await leaveSummary(page)
  const acceptButton = page.getByRole('button', { name: '✓ Accept', exact: true })
  await expect(acceptButton).toBeVisible({ timeout: 15000 })
  const nextButton = page.getByRole('button', { name: 'next flag →', exact: true })
  while (await acceptButton.isVisible()) {
    await acceptButton.click()
    if ((await nextButton.isVisible()) && (await nextButton.isEnabled())) {
      await nextButton.click()
    } else {
      break
    }
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
  await page.getByRole('button', { name: '+ Add mock' }).click()

  await page.goto('/')
  await expect(pendingStat).not.toHaveText(before ?? '')
})

test('run pre-analysis clears the pending count', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: /Run pre-analysis \(\d+\)/ }).click()
  await expect(page.getByRole('button', { name: /Run pre-analysis \(0\)/ })).toBeVisible({ timeout: 15000 })
})

test('opening a flagged application shows a field review card with an Accept option', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Review', exact: true }).first().click()
  await leaveSummary(page)
  await expect(page.getByRole('button', { name: '✓ Accept', exact: true })).toBeVisible()
})

test('approve is disabled until all flagged fields are accepted', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Review', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Approve Application' })).toBeDisabled()
})

test('accepting all flagged fields enables Approve', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Review', exact: true }).first().click()
  await acceptAllFlaggedFields(page)
  await expect(page.getByRole('button', { name: 'Approve Application' })).toBeEnabled()
})

test('deny requires rejecting a field and a note', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Review', exact: true }).first().click()
  await leaveSummary(page)
  await page.getByRole('button', { name: '✗ Reject', exact: true }).click()
  await page.getByRole('button', { name: 'Skip to summary' }).click()
  await page.getByRole('button', { name: '✗ Deny' }).click()
  const confirmBtn = page.getByRole('button', { name: 'Confirm Deny' })
  await expect(confirmBtn).toBeDisabled()
  await page.getByPlaceholder('Rejection note (required)…').fill('Government warning is not compliant')
  await expect(confirmBtn).toBeEnabled()
})

test('approving a resolved application returns to the queue and removes its row', async ({ page }) => {
  await page.goto('/')
  const firstRow = page.locator('tbody tr').first()
  const brandName = (await firstRow.locator('td').nth(1).textContent())?.trim()
  await firstRow.getByRole('button', { name: 'Review', exact: true }).click()

  await acceptAllFlaggedFields(page)
  await expect(page.getByRole('button', { name: 'Approve Application' })).toBeEnabled()
  await page.getByRole('button', { name: 'Approve Application' }).click()

  await expect(page).toHaveURL('/')
  if (brandName) {
    await expect(page.getByText(brandName).first()).not.toBeVisible()
  }
})

test('rejecting a resolved application returns to the queue and removes its row', async ({ page }) => {
  await page.goto('/')
  const firstRow = page.locator('tbody tr').first()
  const brandName = (await firstRow.locator('td').nth(1).textContent())?.trim()
  await firstRow.getByRole('button', { name: 'Review', exact: true }).click()

  await leaveSummary(page)
  await page.getByRole('button', { name: '✗ Reject', exact: true }).click()
  await page.getByRole('button', { name: 'Skip to summary' }).click()
  await page.getByRole('button', { name: '✗ Deny' }).click()
  await page.getByPlaceholder('Rejection note (required)…').fill('Government warning is not compliant')
  await page.getByRole('button', { name: 'Confirm Deny' }).click()

  await expect(page).toHaveURL('/')
  if (brandName) {
    await expect(page.getByText(brandName).first()).not.toBeVisible()
  }
})
