import { expect, test } from '@playwright/test';

const firstEmail = process.env.E2E_USER_EMAIL;
const firstPassword = process.env.E2E_USER_PASSWORD;
const secondEmail = process.env.E2E_SECOND_USER_EMAIL;
const secondPassword = process.env.E2E_SECOND_USER_PASSWORD;

async function signIn(page, email, password) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL(url => new URL(url).pathname !== '/login', { timeout: 30000 });
  await expect(page.locator('[data-testid="auth-state"][data-state="authenticated"]')).toBeAttached({ timeout: 30000 });
}

test('private listening room admits invited user and rejects uninvited user', async ({ browser }) => {
  test.skip(!firstEmail || !firstPassword || !secondEmail || !secondPassword, 'Protected two-user E2E credentials required.');

  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  try {
    await signIn(host, firstEmail, firstPassword);
    await signIn(guest, secondEmail, secondPassword);
    await host.goto('/meetings');
    await expect(host.getByRole('heading', { name: 'Meeting Hub' })).toBeVisible({ timeout: 30000 });

    const title = 'E2E artist listening ' + Date.now();
    await host.getByRole('textbox', { name: 'Meeting title' }).fill(title);
    await host.getByRole('textbox', { name: 'Artist name (optional)' }).fill('Test Artist');
    await host.getByRole('button', { name: 'Create private room' }).click();
    await expect(host.getByText('Room created. Share this invitation privately:')).toBeVisible({ timeout: 30000 });
    const invite = await host.getByRole('status').filter({ hasText: 'Room created' }).locator('p').nth(1).innerText();
    const inviteUrl = new URL(invite);
    expect(inviteUrl.searchParams.get('invite')).toBeTruthy();

    const roomPath = inviteUrl.pathname;
    await guest.goto(roomPath);
    await expect(guest.getByRole('alert')).toContainText('invitation link', { timeout: 30000 });

    await guest.goto(invite);
    await expect(guest.getByRole('heading', { name: title })).toBeVisible({ timeout: 30000 });
    await expect(guest.getByText('Featured artist: Test Artist')).toBeVisible();

    await host.goto(roomPath);
    await host.getByRole('button', { name: 'Start meeting' }).click();
    await expect(host.getByRole('button', { name: 'Join video room' })).toBeVisible({ timeout: 30000 });
    await guest.reload();
    await expect(guest.getByRole('button', { name: 'Join video room' })).toBeVisible({ timeout: 30000 });
    await guest.getByRole('button', { name: 'Join video room' }).click();
    await expect(guest.getByText('Connection:', { exact: false })).toBeVisible({ timeout: 30000 });

    await host.getByRole('button', { name: 'End meeting for everyone' }).click();
    await expect(host.getByText('This meeting has ended.')).toBeVisible({ timeout: 30000 });
    await guest.reload();
    await expect(guest.getByText('This meeting has ended.')).toBeVisible({ timeout: 30000 });
  } finally {
    await hostContext.close();
    await guestContext.close();
  }
});
