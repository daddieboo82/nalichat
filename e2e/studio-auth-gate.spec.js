import { expect, test } from '@playwright/test';

test.describe('Studio authentication routing', () => {
  test('an unauthenticated visitor is redirected from Studio to sign-in', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto('/studio');
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fstudio/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^log in$/i })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Studio sign-in preserves the intended return destination', async ({ page }) => {
    await page.goto('/studio');
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fstudio/, { timeout: 30_000 });
    const url = new URL(page.url());
    expect(url.searchParams.get('returnTo')).toBe('/studio');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });
});
