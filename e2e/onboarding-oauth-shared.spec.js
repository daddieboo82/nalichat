import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const authenticated = Boolean(email && password);

async function login(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL((u) => new URL(u).pathname !== '/login', { timeout: 30000 });
  await expect(page.locator('[data-testid="auth-state"][data-state="authenticated"]')).toBeAttached({ timeout: 30000 });
  await expect(page.getByText('Loading app...', { exact: true })).toBeHidden({ timeout: 30000 });
  await page.waitForTimeout(750);
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

function filterNoise(errors) {
  return errors.filter(
    (x) =>
      !/favicon|Failed to load resource.*(?:401|404)|Public settings check failed:.*404|ERR_ABORTED|NS_BINDING_ABORTED|Load request cancelled|bat\.bing\.com|gtag|googletagmanager|livekit|socket|websocket|403 Forbidden|ERR_CONNECTION|net::ERR|Network request failed|Failed to fetch dynamically imported|Viewport argument key .* not recognized and ignored/i.test(
        x,
      ),
  );
}

test.describe('onboarding and OAuth flows', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run onboarding E2E.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('onboarding page renders wizard interface', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/onboarding', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/onboarding');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    const hasContent = await page.locator('main, [role="main"], form').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
    expect(filterNoise(errors)).toEqual([]);
  });

  test('OAuth consent page renders without crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/oauth-consent', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/oauth-consent');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });
    expect(filterNoise(errors)).toEqual([]);
  });
});

test.describe('shared file public route', () => {
  test('shared file page renders without login', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/shared-file', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/shared-file');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /share link unavailable/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/invalid, expired, or has been replaced/i)).toBeVisible();
    expect(filterNoise(errors)).toEqual([]);
  });

  test('shared file with invalid token shows error state', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/shared-file?token=invalid-token-12345', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /share link unavailable/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/invalid, expired, or has been replaced/i)).toBeVisible();
    expect(filterNoise(errors)).toEqual([]);
  });
});

test.describe('world hub deep route', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run world hub E2E.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('invalid world id redirects or shows fallback', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/world/nonexistent-world-12345', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    const path = new URL(page.url()).pathname;
    const isHome = path === '/';
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(isHome || hasContent).toBeTruthy();
    expect(filterNoise(errors)).toEqual([]);
  });
});

test.describe('authentication edge cases', () => {
  test('forgot password page renders form', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/forgot-password');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#email, input[type="email"]').first()).toBeVisible({ timeout: 10000 });
    expect(filterNoise(errors)).toEqual([]);
  });

  test('reset password page renders without crash on invalid token', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/reset-password?token=invalid-token-12345', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/reset-password');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    const hasContent = await page.locator('input, [role="alert"], h1, h2').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
    expect(filterNoise(errors)).toEqual([]);
  });

  test('register page renders form fields', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/register');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#email, input[type="email"]').first()).toBeVisible({ timeout: 10000 });
    expect(filterNoise(errors)).toEqual([]);
  });
});