import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const authenticated = Boolean(email && password);

async function login(page) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL((url) => new URL(url).pathname !== '/login', {
    timeout: 30000,
    waitUntil: 'domcontentloaded',
  });
  await expect(page.locator('[data-testid="auth-state"][data-state="authenticated"]')).toBeAttached({ timeout: 30000 });
}

test.describe('authenticated production live-session recording', () => {
  test.skip(
    !authenticated,
    'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run the production recording audit.',
  );

  test.skip(
    process.env.E2E_FAKE_MEDIA !== '1',
    'Set E2E_FAKE_MEDIA=1 with a protected fake audio fixture for the production recording audit.',
  );

  test('records a fake microphone track and persists it to the live session', async ({ page, context, baseURL }, testInfo) => {
    await context.grantPermissions(['microphone'], { origin: baseURL });

    const createTrackResponses = [];
    page.on('response', async (response) => {
      if (!/\/functions\/createCollaborativeTrack(?:\/|$)/.test(response.url())) return;
      createTrackResponses.push({ status: response.status(), url: response.url() });
    });

    await login(page);
    await page.goto('/messages');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/messages');

    const sessionName = `E2E Recording ${Date.now()}`;
    await page.getByRole('button', { name: /additional features/i }).click();
    await page.getByRole('textbox', { name: /session name input/i }).fill(sessionName);
    await page.getByRole('button', { name: /^start$/i }).click();

    const session = page.getByText(`Live Session: ${sessionName}`, { exact: true });
    await expect(session).toBeVisible({ timeout: 30000 });

    const recordButton = session.locator('..').getByRole('button', { name: /record track/i });
    await expect(recordButton).toBeVisible({ timeout: 30000 });
    await recordButton.click();

    const stopButton = session.locator('..').getByRole('button', { name: /^stop$/i });
    await expect(stopButton).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);
    await stopButton.click();

    await expect.poll(() => createTrackResponses.length, { timeout: 45000 }).toBeGreaterThan(0);
    expect(createTrackResponses.at(-1).status).toBe(200);
    await expect(page.getByText("Couldn't add the recorded track. Please try again.")).toHaveCount(0);
    await expect(page.getByText("No audio was captured. Please check your microphone and try again.")).toHaveCount(0);
  });
});
