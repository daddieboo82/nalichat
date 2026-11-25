import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const hasAccount = Boolean(email && password);

async function login(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL((url) => new URL(url).pathname !== '/login', { timeout: 30000 });
  await expect(page.locator('[data-testid="auth-state"][data-state="authenticated"]')).toBeAttached({ timeout: 30000 });
  await expect(page.getByText('Loading app...', { exact: true })).toBeHidden({ timeout: 30000 });
}

test.describe('mobile DM composer visibility', () => {
  test.skip(!hasAccount, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD for authenticated DM browser checks.');

  test('existing chat keeps its composer through polling, focus, and orientation changes', async ({ page }, testInfo) => {
    test.skip(!['mobile-chromium', 'iphone-16-simulation'].includes(testInfo.project.name), 'Mobile browsers only.');

    await login(page);
    await page.goto('/messages', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible({ timeout: 30000 });

    // This check requires a pre-existing conversation; do not create chats or send
    // messages simply to satisfy a smoke test.
    const existingChat = page.getByRole('button', { name: /^Open chat with / }).first();
    test.skip(await existingChat.count() === 0, 'Account has no existing visible DM to inspect.');
    await existingChat.click();

    const composer = page.getByTestId('message-composer');
    const input = composer.getByPlaceholder('Message...');
    await expect(composer).toBeVisible({ timeout: 15000 });
    await expect(input).toBeVisible();
    await expect(input).toBeEditable();

    const initialUrl = new URL(page.url());
    expect(initialUrl.searchParams.get('id')).toBeTruthy();
    await page.waitForTimeout(6000); // spans the five-second conversations poll
    await expect(composer).toBeVisible();
    await expect(input).toBeEditable();

    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(composer).toBeVisible();

    await page.setViewportSize({ width: 852, height: 393 });
    await expect(composer).toBeVisible();
    await expect(input).toBeEditable();
    const box = await composer.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);

    await page.setViewportSize({ width: 393, height: 852 });
    await expect(composer).toBeVisible();
    await expect(input).toBeEditable();
  });
});
