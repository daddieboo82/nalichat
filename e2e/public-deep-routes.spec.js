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
      !/favicon|Failed to load resource.*(?:401|404)|Public settings check failed:.*404|ERR_ABORTED|NS_BINDING_ABORTED|Load request cancelled|bat\.bing\.com|gtag|googletagmanager|livekit|socket|websocket|403 Forbidden|ERR_CONNECTION|net::ERR|Network request failed|Failed to fetch dynamically imported/i.test(
        x,
      ),
  );
}

test.describe('public legal and landing pages', () => {
  test('privacy policy renders sections', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/privacy', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/privacy');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /privacy/i }).first()).toBeVisible({ timeout: 10000 });
    expect(filterNoise(errors)).toEqual([]);
  });

  test('terms of service renders sections', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/terms', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/terms');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: /terms/i }).first()).toBeVisible({ timeout: 10000 });
    expect(filterNoise(errors)).toEqual([]);
  });

  test('encryption documentation renders sections', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/encryption-documentation', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/encryption-documentation');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });
    expect(filterNoise(errors)).toEqual([]);
  });

  test('music collaboration landing renders hero', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/music-collaboration', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/music-collaboration');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });
    expect(filterNoise(errors)).toEqual([]);
  });

  test('creator messaging landing renders hero', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/creator-messaging', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/creator-messaging');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });
    expect(filterNoise(errors)).toEqual([]);
  });

  test('music studio landing renders hero', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/music-studio', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/music-studio');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });
    expect(filterNoise(errors)).toEqual([]);
  });
});

test.describe('authenticated deep routes', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run deep-route E2E.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('viral seed page renders XP interface', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/viral-seed', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/viral-seed');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });
    expect(filterNoise(errors)).toEqual([]);
  });

  test('ThankYou page renders without crash', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/ThankYou', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/ThankYou');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    expect(filterNoise(errors)).toEqual([]);
  });

  test('webhook test page renders diagnostics', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/webhook-test', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15000 }).toBe('/webhook-test');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 10000 });
    expect(filterNoise(errors)).toEqual([]);
  });

  test('playlist detail handles invalid id gracefully', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/playlist/nonexistent-id-12345', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    // Should render some content (error state or empty), not a blank crash
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
    expect(filterNoise(errors)).toEqual([]);
  });

  test('challenge leaderboard handles invalid id gracefully', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/challenge/nonexistent-id-12345/leaderboard', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
    expect(filterNoise(errors)).toEqual([]);
  });

  test('submission player handles invalid ids gracefully', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/challenge/nonexistent-id/submission/nonexistent-sub', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
    expect(filterNoise(errors)).toEqual([]);
  });

  test('meeting room handles invalid id gracefully', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/meetings/nonexistent-room-12345', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
    expect(filterNoise(errors)).toEqual([]);
  });

  test('battle room handles invalid id gracefully', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/battles/nonexistent-battle-12345', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body')).toBeVisible({ timeout: 15000 });
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
    expect(filterNoise(errors)).toEqual([]);
  });
});