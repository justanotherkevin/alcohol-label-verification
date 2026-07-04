import { test, expect } from '@playwright/test';

const MOCK_SPECIALIST = JSON.stringify({ id: 'jenny-park', name: 'Jenny Park', role: 'Junior Compliance Agent' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript((specialist) => {
    localStorage.setItem('ttb-specialist', specialist);
  }, MOCK_SPECIALIST);
});

test('dashboard loads as the verification queue', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/TTB/i);
  await expect(page.getByRole('heading', { name: 'Verification Queue' })).toBeVisible();
  await expect(page.getByText('Pending Applications')).toBeVisible();
});
