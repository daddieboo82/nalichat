import { expect, test } from '@playwright/test';

test('public download page renders in browser', async ({ page }) => {
  await page.goto('/download');
  await expect(page).toHaveTitle(/NaliChat/);
  await expect(page.getByRole('heading', { name: 'Download NaliChat' })).toBeVisible();
});

test('protected deep links redirect anonymous users to login', async ({ page }) => {
  await page.goto('/messages');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
});
