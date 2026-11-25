import { expect, test } from '@playwright/test';

// Public checkout entry must never create a PayPal agreement before signup.
test('anonymous mobile customer can choose Premium and retain the selected monthly plan for registration', async ({ page }) => {
  const subscriptionCreationRequests = [];
  page.on('request', request => {
    if (request.url().includes('createPayPalSubscription')) subscriptionCreationRequests.push(request.url());
  });
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
  expect(subscriptionCreationRequests).toEqual([]);
});

test('existing customer keeps Premium plan and campaign context when switching from signup to login', async ({ page }) => {
  const protectedRequests = [];
  page.on('request', request => {
    if (/createPayPalSubscription|sendAgentMessage/.test(request.url())) protectedRequests.push(request.url());
  });
  await page.goto('/pricing?billing=annual&source=mobile-registration-handoff');
  const premium = page.locator('#premium-plan');
  await expect(premium).toBeVisible();
  await premium.getByRole('button', { name: /sign up for premium/i }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/register');
  await expect(page.getByRole('heading', { name: /create your account for premium/i })).toBeVisible();
  await page.getByRole('link', { name: /^log in$/i }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  const destination = new URL(new URL(page.url()).searchParams.get('returnTo'), page.url());
  expect(destination.pathname).toBe('/pricing');
  expect(destination.searchParams.get('plan')).toBe('premium');
  expect(destination.searchParams.get('billing')).toBe('annual');
  expect(destination.searchParams.get('source')).toBe('mobile-registration-handoff');
  await expect(page.locator('#email')).toBeVisible();
  expect(protectedRequests).toEqual([]);
});

test('anonymous mobile customer can choose annual Premium Plus without checkout', async ({ page }) => {
  const subscriptionCreationRequests = [];
  page.on('request', request => {
    if (request.url().includes('createPayPalSubscription')) subscriptionCreationRequests.push(request.url());
  });
  await page.goto('/pricing?billing=annual');
  await expect(page.locator('#premium_plus-plan')).toBeVisible();
  await page.locator('#premium_plus-plan').getByRole('button', { name: /sign up for premium plus/i }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe('/register');
  const target = new URL(new URL(page.url()).searchParams.get('returnTo'), page.url());
  expect(target.searchParams.get('plan')).toBe('premium_plus');
  expect(target.searchParams.get('billing')).toBe('annual');
  expect(subscriptionCreationRequests).toEqual([]);
});
