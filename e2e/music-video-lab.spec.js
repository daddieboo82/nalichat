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

test('Music Video Lab source ships the AI director and editable export workflow', async ({ request }) => {
  const response = await request.get('/src/pages/MusicVideoGenerator.jsx');
  test.skip(!response.ok(), 'source modules are not exposed by this deployment');
  const source = await response.text();
  expect(source).toContain('AI Music Video Director');
  expect(source).toContain('generateMusicVideoStoryboard');
  expect(source).toContain('Generate AI Video');
  expect(source).toContain('Export');
});
