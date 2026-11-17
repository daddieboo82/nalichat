import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const fakeMedia = process.env.E2E_FAKE_MEDIA === '1';

async function login(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL((u) => new URL(u).pathname !== '/login', { timeout: 30000 });
  await expect(page.locator('[data-testid="auth-state"][data-state="authenticated"]')).toBeAttached({ timeout: 30000 });
  await expect(page.getByText('Loading app...', { exact: true })).toBeHidden({ timeout: 30000 });
}

async function openDemoProject(page) {
  await page.goto('/studio');
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/studio');
  const welcome = page.getByRole('heading', { name: /welcome to studio/i });
  await expect(welcome).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: /load demo project/i }).click();
  await expect(welcome).toBeHidden({ timeout: 30000 });
  const clips = page.locator('[data-testid^="studio-audio-clip-"]');
  await expect(clips.first()).toBeVisible({ timeout: 30000 });
  return clips;
}

test.describe('Studio record, split and bounce', () => {
  test.skip(!(email && password), 'requires E2E credentials');

  test('splits a clip and undoes the split', async ({ page }) => {
    await login(page);
    const clips = await openDemoProject(page);
    const before = await clips.count();

    await clips.first().click();
    await page.keyboard.press('Control+e');
    await expect.poll(() => clips.count(), { timeout: 10000 }).toBe(before + 1);

    await page.keyboard.press('Control+z');
    await expect.poll(() => clips.count(), { timeout: 10000 }).toBe(before);
  });

  test('records a take through the armed track', async ({ page }) => {
    test.skip(!fakeMedia, 'Set E2E_FAKE_MEDIA=1 to supply a fake microphone.');
    await page.context().grantPermissions(['microphone']);
    await login(page);
    const clips = await openDemoProject(page);
    const before = await clips.count();

    const record = page.getByRole('button', { name: /^record \(r\)$/i });
    await record.click();
    await expect(record).toHaveAttribute('class', /text-red-500/, { timeout: 15000 });
    await page.waitForTimeout(2500);
    await record.click();

    await expect.poll(() => clips.count(), { timeout: 30000 }).toBeGreaterThan(before);
  });

  test('opens the bounce export for the mix', async ({ page }) => {
    await login(page);
    await openDemoProject(page);

    await page.getByRole('button', { name: /^export$/i }).click();
    await page.getByRole('menuitem', { name: /export & publish/i }).click();

    const bounce = page.getByRole('dialog');
    await expect(bounce).toBeVisible({ timeout: 15000 });
    await expect(bounce.getByRole('button', { name: /bounce|export|publish/i }).first()).toBeVisible({ timeout: 15000 });
  });
});