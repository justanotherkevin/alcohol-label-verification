import { test, expect } from '@playwright/test';

test('dashboard loads as the verification queue', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/TTB/i);
  await expect(page.getByRole('heading', { name: 'Verification Queue' })).toBeVisible();
  await expect(page.getByText('Pending Applications')).toBeVisible();
  await expect(page.getByRole('button', { name: '+ Add mock application' })).toBeVisible();
});
