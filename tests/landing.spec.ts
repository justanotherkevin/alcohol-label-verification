import { test, expect } from '@playwright/test';

test('landing page loads and key elements are visible', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/TTB/i);
  await expect(page.getByRole('heading', { name: 'TTB Label Verification' })).toBeVisible();
  await expect(page.getByText('Drop label image here')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify Label' })).toBeVisible();
  await expect(page.getByText('Brand Name')).toBeVisible();
});
