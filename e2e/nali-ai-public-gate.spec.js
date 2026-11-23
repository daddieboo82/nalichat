import { expect, test } from '@playwright/test';

// Public-path browser checks do not require test credentials and do not
// generate any AI request or touch a customer's quota.
test.describe('NALI.ai anonymous access gate', () => {
  test('anonymous users cannot enter the protected Studio to reach NALI.ai', async ({ page }) => {
    await page.goto('/studio');
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
    await expect.poll(() => new URL(page.url()).search).toBe('?returnTo=%2Fstudio');
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('anonymous assistant events never dispatch an AI request', async ({ page }) => {
    const aiRequests = [];
    page.on('request', (request) => {
      if (/\/functions\/(sendAgentMessage)(?:\/|\?|$)/.test(request.url())) aiRequests.push(request.url());
    });
    await page.goto('/login');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('open-ai-assistant'));
      window.dispatchEvent(new CustomEvent('nali-send-message', { detail: { message: 'Do not send anonymously' } }));
    });
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect.poll(() => aiRequests.length, { timeout: 5000 }).toBe(0);
  });
});
