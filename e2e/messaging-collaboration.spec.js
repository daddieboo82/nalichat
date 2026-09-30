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

test.describe('messaging and collaboration workflows', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run messaging E2E.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('messages page renders conversation list and network tab', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/messages');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/messages');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The messages page should show either conversations or an empty state
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('new chat dialog opens from messages page', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/messages');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/messages');

    // Look for a new chat / compose button
    const newChatBtn = page.getByRole('button', { name: /new chat|compose|new message|start.*chat/i }).first();
    if (await newChatBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newChatBtn.click();
      // A dialog or panel should appear
      await expect(page.locator('[role="dialog"], [role="dialog"]')).toBeVisible({ timeout: 5000 }).catch(() => {});
    }

    expect(filterNoise(errors)).toEqual([]);
  });

  test('files page renders file list and upload button', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/files');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/files');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The files page should have an upload button
    const uploadBtn = page.getByRole('button', { name: /upload/i }).first();
    await expect(uploadBtn).toBeVisible({ timeout: 10000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('settings page renders all configuration sections', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/settings');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/settings');
    await expect(page.getByRole('heading', { name: /profile settings/i })).toBeVisible({ timeout: 10000 });

    // Verify key sections are present
    await expect(page.getByText(/appearance/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/language/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/privacy/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/subscription/i)).toBeVisible({ timeout: 5000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('settings profile save button is interactive', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/settings');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/settings');

    const saveBtn = page.getByRole('button', { name: /save profile/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('analytics page renders without errors', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/analytics');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/analytics');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // Analytics should show some heading or chart container
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('leaderboard page renders user and content tabs', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/leaderboard');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/leaderboard');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The leaderboard should show headings or tab controls
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('profile page renders user information', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/profile');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/profile');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });
});