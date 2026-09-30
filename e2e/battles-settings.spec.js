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

test.describe('battles and settings workflows', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run battles E2E.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('live battles stage renders preview and lobby link', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/battles');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/battles');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The stage preview should be visible
    await expect(page.getByText(/stage preview/i)).toBeVisible({ timeout: 10000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('battle lobby renders sections and awards', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/battles/lobby');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/battles/lobby');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The lobby should show battle sections
    await expect(page.getByText(/battle lobby/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/live now/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/battle awards/i)).toBeVisible({ timeout: 5000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('meeting hub renders room planner and list', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/meetings');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/meetings');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The meeting planner should be visible
    await expect(page.getByText(/meeting hub/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/plan a private room/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/your rooms/i)).toBeVisible({ timeout: 5000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('settings page renders profile form and preferences', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/settings');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/settings');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // Profile settings heading
    await expect(page.getByText(/profile settings/i)).toBeVisible({ timeout: 10000 });

    // Display name field should be visible
    await expect(page.getByLabel(/display name/i)).toBeVisible({ timeout: 5000 });

    // Language section should be present
    await expect(page.getByText(/language/i).first()).toBeVisible({ timeout: 5000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('live TV page renders streaming interface', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/live-tv');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/live-tv');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('music video generator page renders creation interface', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/music-video-generator');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/music-video-generator');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('artist career OS page renders dashboard interface', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/artist-career-os');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/artist-career-os');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('artist release center page renders release workflow', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/artist-release-center');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/artist-release-center');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });
});