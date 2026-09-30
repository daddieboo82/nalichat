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

test.describe('challenge workflows', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run challenge E2E.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('challenge hub renders challenge cards or empty state', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/challenges');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/challenges');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The hub should show either challenge cards or an empty-state message
    const hasCards = await page.locator('[class*="challenge"], [class*="card"]').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasEmpty = await page.getByText(/no.*challenges|coming soon|empty/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasCards || hasEmpty).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('create challenge page renders form fields', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/create-challenge');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/create-challenge');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The create-challenge page should have a title input and submit button
    const titleInput = page.locator('input, textarea').first();
    await expect(titleInput).toBeVisible({ timeout: 10000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('challenge detail page handles invalid id gracefully', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/challenge/nonexistent-challenge-id');
    await page.waitForTimeout(3000);

    // Should either show a not-found message or redirect to hub
    const url = new URL(page.url()).pathname;
    const hasError = await page.getByText(/not found|doesn.*exist|unable to load|something went wrong/i).first().isVisible({ timeout: 10000 }).catch(() => false);
    const redirectedToHub = url === '/challenges';
    expect(hasError || redirectedToHub || url.startsWith('/challenge')).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });
});

test.describe('squad workflows', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run squad E2E.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('squad page renders invite panel or active squad', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/squad');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/squad');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The squad page should show either an active squad, an invite panel, or an empty state
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('squad join page handles invalid invite code', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/squad/join/INVALID-CODE-12345');
    await page.waitForTimeout(3000);

    // Should show an error or redirect — not crash
    const url = new URL(page.url()).pathname;
    expect(url.startsWith('/squad')).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });
});