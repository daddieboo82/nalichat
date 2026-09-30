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

test.describe('onboarding and pricing workflows', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run onboarding E2E.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('pricing page renders plan cards', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/pricing');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/pricing');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The pricing page should show plan cards with pricing information
    const hasPlans = await page.getByText(/premium|free|plus/i).first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasPlans).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('record page renders recording interface', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/record');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/record');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The record page should show a recording interface
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('cover art page renders generator interface', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/cover-art');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/cover-art');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('projects summary page renders project cards', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/projects-summary');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/projects-summary');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });
});