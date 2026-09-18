import { expect, test } from '@playwright/test';

const primary = { email: process.env.E2E_USER_EMAIL, password: process.env.E2E_USER_PASSWORD };
const secondary = { email: process.env.E2E_SECOND_USER_EMAIL, password: process.env.E2E_SECOND_USER_PASSWORD };

async function login(page, account) {
  await page.goto('/login');
  await page.locator('#email').fill(account.email);
  await page.locator('#password').fill(account.password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL(url => new URL(url).pathname !== '/login', { timeout: 30000 });
  await expect(page.locator('[data-testid="auth-state"][data-state="authenticated"]')).toBeAttached({ timeout: 30000 });
  await expect(page.getByText('Loading app...', { exact: true })).toBeHidden({ timeout: 30000 });
}

test.describe('Messages non-admin production audit', () => {
  test.skip(!(primary.email && primary.password && secondary.email && secondary.password), 'Both protected E2E accounts are required.');

  test('contacts populate and a contact opens a DM', async ({ page }) => {
    const diagnostics = [];
    page.on('response', r => {
      if (/message|contact|conversation|user/i.test(r.url()) && r.status() >= 400)
        diagnostics.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    });
    page.on('pageerror', e => diagnostics.push(`PAGEERROR ${e.message}`));

    await login(page, primary);
    await page.goto('/messages');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/messages');

    const network = page.getByRole('button', { name: /^network$/i });
    if (await network.count()) await network.click();

    const scroll = page.getByTestId('messages-contacts-scroll');
    await expect(scroll, 'Messages contact panel must render for a normal account').toBeVisible({ timeout: 30000 });

    const candidates = scroll.locator('button, [role="button"], a').filter({ hasNotText: /^$/ });
    await expect.poll(async () => candidates.count(), {
      message: 'Expected at least one selectable contact for the non-admin account',
      timeout: 30000,
    }).toBeGreaterThan(0);

    const beforeUrl = page.url();
    const first = candidates.first();
    const label = ((await first.innerText().catch(() => '')) || (await first.getAttribute('aria-label')) || 'unknown').trim();
    console.log('MESSAGES_AUDIT_CONTACT', label);
    await first.click();

    const composer = page.locator('textarea, input[placeholder*="message" i], [contenteditable="true"]').first();
    try {
      await expect(composer, 'Selecting a contact must open a usable DM composer').toBeVisible({ timeout: 15000 });
    } catch (e) {
      console.log('MESSAGES_AUDIT_DIAGNOSTICS', JSON.stringify({ beforeUrl, afterUrl: page.url(), diagnostics }));
      throw e;
    }
    expect(diagnostics.filter(x => / 401 | 403 /.test(` ${x} `)), 'No authorization failures should occur while opening the DM').toEqual([]);
  });

  test('two non-admin sessions can independently reach Messages', async ({ browser }) => {
    for (const account of [primary, secondary]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, account);
      await page.goto('/messages');
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/messages');
      await expect(page.getByTestId('messages-contacts-scroll')).toBeVisible({ timeout: 30000 });
      await context.close();
    }
  });
});
