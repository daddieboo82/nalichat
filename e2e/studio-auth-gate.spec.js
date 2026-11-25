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

  test('Studio registration link preserves the protected return destination', async ({ page }) => {
    await page.goto('/studio');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
    const signUp = page.getByRole('link', { name: /create.*account|sign up|register/i }).first();
    await expect(signUp).toBeVisible();
    await signUp.click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/register');
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/studio');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('signup handoff strips unsafe session overrides but keeps the protected route', async ({ page }) => {
    const unsafeReturn = '/studio?source=signup-security-check&access_token=attacker&clear_access_token=true&app_id=wrong-app&backend_url=https%3A%2F%2Fevil.example';
    await page.goto('/login?returnTo=' + encodeURIComponent(unsafeReturn));
    await page.getByRole('link', { name: /create a free account/i }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/register');
    const destination = new URL(page.url()).searchParams.get('returnTo');
    expect(destination).toBe('/studio?source=signup-security-check');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('signup handoff rejects an off-site return destination', async ({ page }) => {
    await page.goto('/login?returnTo=' + encodeURIComponent('https://evil.example/steal'));
    await page.getByRole('link', { name: /create a free account/i }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/register');
    expect(new URL(page.url()).searchParams.get('returnTo')).toBe('/');
    await expect(page.locator('input[type="email"]')).toBeVisible();
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
