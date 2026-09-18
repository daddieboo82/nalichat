import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const secondEmail = process.env.E2E_SECOND_USER_EMAIL;
const secondPassword = process.env.E2E_SECOND_USER_PASSWORD;

const authenticated = Boolean(email && password);

async function login(page, userEmail, userPassword) {
  await page.goto('/login');
  await page.locator('#email').fill(userEmail);
  await page.locator('#password').fill(userPassword);
  await page.getByRole('button', { name: /^log in$/i }).click();

  await page.waitForURL(
    (url) => new URL(url).pathname !== '/login',
    { timeout: 30000, waitUntil: 'domcontentloaded' },
  );
  await expect(page.locator('[data-testid="auth-state"][data-state="authenticated"]')).toBeAttached({ timeout: 30000 });
  await expect(page.getByText('Loading app...', { exact: true })).toBeHidden({ timeout: 30000 });
}

async function expectProtectedRoute(page, route) {
  const pageErrors = [];
  const failedRequests = [];

  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText || '';
    if (!/ERR_ABORTED|NS_BINDING_ABORTED|Load request cancelled/i.test(failure)) {
      failedRequests.push(`${request.method()} ${request.url()} :: ${failure}`);
    }
  });

  await page.goto(route);
  await page.waitForLoadState('domcontentloaded');
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).not.toBe('/login');
  await expect(page.locator('body')).toBeVisible();

  expect(pageErrors, `page errors on ${route}`).toEqual([]);
  expect(failedRequests, `failed requests on ${route}`).toEqual([]);
}

test.describe('authenticated production smoke', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run authenticated production checks.');

  test.beforeEach(async ({ page }) => {
    await login(page, email, password);
  });

  for (const route of ['/messages', '/files', '/studio', '/settings']) {
    test(`${route} loads while authenticated without browser errors`, async ({ page }) => {
      await expectProtectedRoute(page, route);
    });
  }



  test('uploads and surfaces a small file in Files', async ({ page }) => {
    await page.goto('/files');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/files');

    const fileName = `e2e-${Date.now()}.txt`;
    await page.getByRole('button', { name: /upload/i }).first().click();
    await page.getByTestId('files-upload-input').setInputFiles({
      name: fileName,
      mimeType: 'text/plain',
      buffer: Buffer.from('NaliChat production E2E upload check'),
    });

    await expect(page.getByText(fileName, { exact: false })).toBeVisible({ timeout: 30000 });
  });

  test('mobile Messages Network remains vertically scrollable', async ({ page }, testInfo) => {
    test.skip(
      !['mobile-chromium', 'iphone-16-simulation'].includes(testInfo.project.name),
      'Mobile contacts scroll flow only.',
    );

    await page.goto('/messages');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/messages');
    await page.getByRole('button', { name: /^network$/i }).click();

    const contactsScroll = page.getByTestId('messages-contacts-scroll');
    await expect(contactsScroll).toBeVisible({ timeout: 30000 });
    await expect(contactsScroll).toHaveCSS('overflow-y', 'auto');

    const before = await contactsScroll.evaluate((node) => ({
      top: node.scrollTop,
      height: node.scrollHeight,
      client: node.clientHeight,
    }));

    if (before.height > before.client) {
      await contactsScroll.evaluate((node) => node.scrollTo({ top: node.scrollHeight, behavior: 'instant' }));
      await expect.poll(() => contactsScroll.evaluate((node) => node.scrollTop)).toBeGreaterThan(before.top);
      await contactsScroll.evaluate((node) => node.scrollTo({ top: 0, behavior: 'instant' }));
      await expect.poll(() => contactsScroll.evaluate((node) => node.scrollTop)).toBe(0);
    }
  });

  test('authenticated session survives reload and protected navigation', async ({ page }) => {
    await page.goto('/messages');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/messages');
    await page.reload();
    await expect.poll(() => new URL(page.url()).pathname).toBe('/messages');

    await page.goto('/settings');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/settings');
  });
});

test.describe('account isolation smoke', () => {
  test.skip(
    !(authenticated && secondEmail && secondPassword),
    'Set both primary and secondary E2E credentials to run account-isolation checks.',
  );

  test('two accounts can authenticate independently without sharing browser storage', async ({ browser }) => {
    const firstContext = await browser.newContext();
    const secondContext = await browser.newContext();
    const firstPage = await firstContext.newPage();
    const secondPage = await secondContext.newPage();

    await login(firstPage, email, password);
    await login(secondPage, secondEmail, secondPassword);

    await firstPage.goto('/messages');
    await secondPage.goto('/messages');

    await expect.poll(() => new URL(firstPage.url()).pathname).toBe('/messages');
    await expect.poll(() => new URL(secondPage.url()).pathname).toBe('/messages');

    const firstStorage = await firstContext.storageState();
    const secondStorage = await secondContext.storageState();
    expect(JSON.stringify(firstStorage)).not.toBe(JSON.stringify(secondStorage));

    await firstContext.close();
    await secondContext.close();
  });
});


test.describe('mobile logout and account switch', () => {
  test.skip(
    !(authenticated && secondEmail && secondPassword),
    'Set both primary and secondary E2E credentials to run mobile account-switch checks.',
  );

  test('mobile logout clears the first session before the second account signs in', async ({ page }, testInfo) => {
    test.skip(
      !['mobile-chromium', 'iphone-16-simulation'].includes(testInfo.project.name),
      'Mobile navigation flow only.',
    );

    await login(page, email, password);
    await page.getByRole('button', { name: /open menu/i }).click();
    await page.getByRole('button', { name: /log out/i }).click();

    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/');
    await expect(page.locator('[data-testid="auth-state"][data-state="anonymous"]')).toBeAttached({ timeout: 30000 });
    await page.goto('/messages');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/login');

    await login(page, secondEmail, secondPassword);
    await page.goto('/messages');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/messages');
  });
});
