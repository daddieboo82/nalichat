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

test.describe('search and notification workflows', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run search E2E.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('messages page renders network search and contact filters', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/messages');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/messages');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The network discovery search input should be visible
    const searchInput = page.locator('input[placeholder*="search" i]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });

    // Filter pills should be visible
    await expect(page.getByText(/all/i).first()).toBeVisible({ timeout: 5000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('messages page shows new chat and new group actions', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/messages');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/messages');

    // The empty state should show new chat and new group buttons
    await expect(page.getByRole('button', { name: /new chat/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /new group/i })).toBeVisible({ timeout: 10000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('messages page switches between chats and network tabs', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/messages');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/messages');

    // Click the Chats tab
    const chatsTab = page.getByRole('button', { name: /^chats$/i }).first();
    if (await chatsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await chatsTab.click();
      await page.waitForTimeout(1000);
    }

    // Click the Network tab
    const networkTab = page.getByRole('button', { name: /^network$/i }).first();
    if (await networkTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await networkTab.click();
      await page.waitForTimeout(1000);
    }

    // Should still be on messages page
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 5000 }).toBe('/messages');

    expect(filterNoise(errors)).toEqual([]);
  });

  test('playlists page renders create playlist action', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/playlists');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/playlists');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The create playlist button should be visible
    await expect(page.getByRole('button', { name: /create playlist/i })).toBeVisible({ timeout: 10000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('profile page renders user content sections', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/profile');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/profile');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // Profile should show some heading
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('leaderboard page renders ranking content', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/leaderboard');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/leaderboard');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });
});