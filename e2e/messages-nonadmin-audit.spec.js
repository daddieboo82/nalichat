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

async function openNetwork(page) {
  const network = page.getByRole('button', { name: /^network$/i });
  await expect(network, 'Messages must expose the Network tab').toBeVisible({ timeout: 30000 });
  await network.click();
  await expect(page.getByTestId('messages-contacts-scroll'), 'Network must render the contacts/discovery panel').toBeVisible({ timeout: 30000 });
}

test.describe('Messages non-admin production audit', () => {
  test.skip(!(primary.email && primary.password && secondary.email && secondary.password), 'Both protected E2E accounts are required.');

  test('contacts populate and a contact opens a DM', async ({ page }) => {
    const diagnostics = [];
    page.on('response', r => {
      if (/message|contact|conversation|user|listPublicUsers/i.test(r.url()) && r.status() >= 400)
        diagnostics.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    });
    page.on('pageerror', e => diagnostics.push(`PAGEERROR ${e.message}`));

    await login(page, primary);
    await page.goto('/messages');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/messages');

    try {
      await openNetwork(page);
    } catch (e) {
      console.log('MESSAGES_AUDIT_NETWORK_FAILURE', JSON.stringify({ url: page.url(), diagnostics }));
      throw e;
    }

    const scroll = page.getByTestId('messages-contacts-scroll');
    const contactList = page.getByTestId('messages-contact-list');
    await expect(contactList, 'Network directory must finish loading').toBeAttached({ timeout: 30000 });

    const messageButtons = scroll.getByRole('button', { name: /^message$/i });
    await expect.poll(async () => messageButtons.count(), {
      message: 'Expected at least one discoverable/contact user with a Message button',
      timeout: 30000,
    }).toBeGreaterThan(0);

    const beforeUrl = page.url();
    const first = messageButtons.first();
    console.log('MESSAGES_AUDIT_MESSAGE_BUTTONS', await messageButtons.count());
    await first.click();

    const composer = page.locator('textarea, input[placeholder*="message" i], [contenteditable="true"]').first();
    try {
      await expect(composer, 'Selecting a person must open a usable DM composer').toBeVisible({ timeout: 15000 });
    } catch (e) {
      console.log('MESSAGES_AUDIT_DM_FAILURE', JSON.stringify({ beforeUrl, afterUrl: page.url(), diagnostics }));
      throw e;
    }
    expect(diagnostics.filter(x => / 401 | 403 /.test(` ${x} `) && !/\/entities\/User\/me(?:[/?#]|$)/.test(x)), 'No authorization failures should occur while opening the DM').toEqual([]);
  });

  test('two non-admin accounts can exchange a real DM', async ({ browser }) => {
    test.setTimeout(240000);
    const a = await browser.newContext();
    const b = await browser.newContext();
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    const token = `NaliChat E2E ${Date.now()}`;
    const reply = `${token} reply`;

    try {
      await login(pageA, primary);
      await login(pageB, secondary);
      await pageA.goto('/messages');
      await pageB.goto('/messages');
      await openNetwork(pageA);

      const search = pageA.getByPlaceholder(/Search by name, genre, or location/i);
      await expect(search).toBeVisible({ timeout: 30000 });
      await search.fill(secondary.email);
      const messageButtons = pageA.getByTestId('messages-contacts-scroll').getByRole('button', { name: /^message$/i });
      if (await messageButtons.count() === 0) {
        await search.fill('');
      }
      await expect.poll(async () => messageButtons.count(), { timeout: 30000 }).toBeGreaterThan(0);
      await messageButtons.first().click();

      const inputA = pageA.getByRole('textbox', { name: 'Message Input' });
      await expect(inputA).toBeVisible({ timeout: 30000 });
      await expect(inputA).toBeEnabled({ timeout: 30000 });
      await inputA.click();
      await inputA.pressSequentially(token, { delay: 10 });
      await pageA.getByRole('button', { name: 'Send Message' }).click();
      await expect(pageA.getByText(token, { exact: true }).last()).toBeVisible({ timeout: 30000 });

      await pageB.goto('/messages');
      await expect(pageB.getByText(token, { exact: true }).last()).toBeVisible({ timeout: 45000 });
      const inputB = pageB.getByRole('textbox', { name: 'Message Input' });
      await expect(inputB).toBeVisible({ timeout: 30000 });
      await expect(inputB).toBeEnabled({ timeout: 30000 });
      await inputB.click();
      await inputB.pressSequentially(reply, { delay: 10 });
      await pageB.getByRole('button', { name: 'Send Message' }).click();
      await expect(pageB.getByText(reply, { exact: true }).last()).toBeVisible({ timeout: 30000 });
      await expect(pageA.getByText(reply, { exact: true }).last()).toBeVisible({ timeout: 45000 });
    } finally {
      await a.close().catch(() => {});
      await b.close().catch(() => {});
    }
  });

  test('two non-admin sessions can independently reach Network', async ({ browser }) => {
    test.setTimeout(90000);
    for (const account of [primary, secondary]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const diagnostics = [];
      page.on('response', r => {
        if (/message|contact|conversation|user|listPublicUsers/i.test(r.url()) && r.status() >= 400)
          diagnostics.push(`${r.status()} ${r.request().method()} ${r.url()}`);
      });
      try {
        await login(page, account);
        await page.goto('/messages');
        await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/messages');
        await openNetwork(page);
        await expect(page.getByTestId('messages-contact-list'), 'Network directory must finish loading for each non-admin account').toBeAttached({ timeout: 30000 });
        expect(diagnostics.filter(x => / 401 | 403 /.test(` ${x} `) && !/\/entities\/User\/me(?:[/?#]|$)/.test(x))).toEqual([]);
      } catch (e) {
        console.log('MESSAGES_AUDIT_SESSION_FAILURE', JSON.stringify({ url: page.url(), diagnostics }));
        throw e;
      } finally {
        await context.close().catch(() => {});
      }
    }
  });
});
