import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

async function login(page) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL((url) => new URL(url).pathname !== '/login', { timeout: 30000 });
}

test.describe('NaliVision E2E audit', () => {
  test.skip(!(email && password), 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD.');
  test('loads Free TV, lists channels, and plays a browser-compatible HLS channel', async ({ page }) => {
    const browserErrors = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));

    await login(page);
    await page.goto('/live-tv');
    await expect(page.getByRole('heading', { name: 'NaliVision' })).toBeVisible();

    await page.getByRole('button', { name: /free tv/i }).click();
    await expect(page.getByText(/Channels \([1-9][0-9]*\)/)).toBeVisible({ timeout: 30000 });

    const candidates = page.locator('aside button');
    const count = Math.min(await candidates.count(), 20);
    expect(count).toBeGreaterThan(0);

    let played = false;
    const attempts = [];
    for (let i = 0; i < count; i += 1) {
      const button = candidates.nth(i);
      const name = (await button.innerText()).split('\n')[0].trim();
      await button.click();
      const video = page.locator('video');
      await expect(video).toBeVisible();

      try {
        await expect.poll(
          () => video.evaluate((el) => ({ readyState: el.readyState, error: el.error?.code || 0 })),
          { timeout: 12000, intervals: [500, 1000, 2000] },
        ).toMatchObject({ readyState: 4, error: 0 });
        const state = await video.evaluate((el) => ({
          readyState: el.readyState,
          networkState: el.networkState,
          paused: el.paused,
          currentTime: el.currentTime,
          duration: el.duration,
          error: el.error?.message || null,
        }));
        attempts.push({ name, ...state });
        played = state.readyState >= 3 && !state.error;
        if (played) break;
      } catch {
        attempts.push(await video.evaluate((el) => ({
          name,
          readyState: el.readyState,
          networkState: el.networkState,
          paused: el.paused,
          currentTime: el.currentTime,
          error: el.error?.message || null,
        })));
      }
    }

    console.log('NALIVISION_PLAYBACK_AUDIT', JSON.stringify(attempts));
    expect(browserErrors, 'NaliVision browser errors').toEqual([]);
    expect(played, 'At least one of the first 20 Free TV channels should reach playable media state').toBe(true);
  });
});
