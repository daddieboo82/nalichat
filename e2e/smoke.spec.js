import { expect, test } from '@playwright/test';

test('public login page renders in browser', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle(/NaliChat/);
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test('protected deep links redirect anonymous users to login', async ({ page }) => {
  await page.goto('/messages');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  await expect.poll(() => new URL(page.url()).search).toBe('?returnTo=%2Fmessages');
  await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
});


test('public registration page renders required account fields', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(2);
  await expect(page.getByRole('button', { name: /create account/i })).toBeVisible();
});

test('forgot-password page renders without revealing account existence', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page.getByRole('heading', { name: /reset password/i })).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible();
});

test('unknown routes render the production 404 page', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
  await expect(page.getByText(/AI hasn't implemented/i)).toHaveCount(0);
});


test('public shared-file route does not require login', async ({ page }) => {
  await page.goto('/shared-file');
  await expect(page.getByRole('heading', { name: /share link unavailable/i })).toBeVisible();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/shared-file');
});
