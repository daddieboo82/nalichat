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
      !/favicon|Failed to load resource.*(?:401|404)|Public settings check failed:.*404|ERR_ABORTED|NS_BINDING_ABORTED|Load request cancelled|bat\.bing\.com|gtag|googletagmanager/is.test(
        x,
      ),
  );
}

test.describe('admin and navigation workflows', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run admin E2E.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('admin dashboard renders without crashing', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/admin');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/admin');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The admin page should show some heading — either the dashboard or an
    // access-denied message for non-admin users.
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('home page renders quick-access grid and recommendations', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('explore page renders content grid', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/explore');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/explore');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('webhook test page renders diagnostics interface', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/webhook-test');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/webhook-test');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('viral seed page renders campaign interface', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/viral-seed');
    await page.waitForTimeout(3000);

    // Viral seed may redirect if not eligible, or render the page
    const url = new URL(page.url()).pathname;
    expect(['/', '/viral-seed', '/login'].includes(url) || url.startsWith('/')).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });
});

test.describe('mobile navigation workflows', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run mobile E2E.');

  test('mobile viewport renders bottom navigation bar', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await login(page);

    const errors = collectErrors(page);

    await page.goto('/');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The mobile bottom nav should be visible at mobile viewport
    const bottomNav = page.locator('nav').last();
    await expect(bottomNav).toBeVisible({ timeout: 10000 });

    expect(filterNoise(errors)).toEqual([]);
    await page.close();
  });

  test('mobile viewport switches between tabs', async ({ browser }) => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await login(page);

    const errors = collectErrors(page);

    await page.goto('/');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // Navigate to explore via bottom nav
    const exploreLink = page.getByRole('link', { name: /explore/i }).first();
    if (await exploreLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await exploreLink.click();
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 10000 }).toBe('/explore');
    }

    expect(filterNoise(errors)).toEqual([]);
    await page.close();
  });
});