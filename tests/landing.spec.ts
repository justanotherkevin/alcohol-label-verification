import { test, expect } from '@playwright/test';

test('dashboard loads with queue table and metrics', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/TTB/i);
  await expect(page.getByRole('heading', { name: 'Verification Dashboard' })).toBeVisible();
  await expect(page.getByText('Pending Reviews')).toBeVisible();
  await expect(page.getByText('Verification Queue')).toBeVisible();
});

test('verify page loads with upload form', async ({ page }) => {
  await page.goto('/verify');

  await expect(page.getByText('Drop label image here')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify Label' })).toBeVisible();
  await expect(page.getByText('Brand Name')).toBeVisible();
});
