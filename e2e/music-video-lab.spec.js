import { expect, test } from '@playwright/test';

test('Music Video Lab remains protected for anonymous visitors', async ({ page }) => {
  await page.goto('/music-video-generator');
  await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
  await expect.poll(() => new URL(page.url()).search).toContain('returnTo=%2Fmusic-video-generator');
});

test('Music Video Lab release is present in the production bundle', async ({ request }) => {
  const response = await request.get('/music-video-generator');
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain('<div id="root"');
});
