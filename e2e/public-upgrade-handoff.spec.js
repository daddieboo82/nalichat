import { expect, test } from '@playwright/test';

// Public checkout entry must never create a PayPal agreement before signup.
test('anonymous mobile customer can choose Premium and retain the selected monthly plan for registration', async ({ page }) => {
  await page.goto('/pricing?source=mobile-release-audit', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#premium-plan')).toBeVisible();
  await expect(page.locator('#premium_plus-plan')).toBeVisible();
  await page.locator('#premium-plan').getByRole('button', { name: /sign up for premium/i }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/register');
  const destination = new URL(page.url()).searchParams.get('returnTo');
  expect(destination).toBeTruthy();
  const target = new URL(destination, page.url());
  expect(target.pathname).toBe('/pricing');
  expect(target.searchParams.get('plan')).toBe('premium');
  expect(target.searchParams.get('billing')).toBe('monthly');
  expect(target.searchParams.get('source')).toBe('mobile-release-audit');
  await expect(page.locator('input[type="email"]')).toBeVisible();
});

test('anonymous mobile customer can choose annual Premium Plus without checkout', async ({ page }) => {
  await page.goto('/pricing?billing=annual');
  await expect(page.locator('#premium_plus-plan')).toBeVisible();
  await page.locator('#premium_plus-plan').getByRole('button', { name: /sign up for premium plus/i }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/register');
  const target = new URL(new URL(page.url()).searchParams.get('returnTo'), page.url());
  expect(target.searchParams.get('plan')).toBe('premium_plus');
  expect(target.searchParams.get('billing')).toBe('annual');
});
