import { expect, test } from '@playwright/test';

test('public login page renders in browser', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle(/NaliChat/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test('protected deep links redirect anonymous users to login', async ({ page }) => {
  await page.goto('/messages');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  await expect.poll(() => new URL(page.url()).search).toBe('');
  await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
});
