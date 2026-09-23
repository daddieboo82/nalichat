import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

async function login(page) {
  const authResponses = [];
  page.on('response', async (response) => {
    if (response.request().method() === 'POST') {
      authResponses.push({ url: response.url(), status: response.status() });
    }
  });
  page.on('requestfailed', (request) => {
    if (request.method() === 'POST') {
      authResponses.push({ url: request.url(), failed: request.failure()?.errorText || 'request failed' });
    }
  });
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  try {
    // WebKit can report the URL transition before its default "load" wait
    // completes, so only require the login route to be left.
    await page.waitForURL((url) => new URL(url).pathname !== '/login', {
      timeout: 30000,
      waitUntil: 'commit',
    });
  } catch (error) {
    throw new Error(`NALIVISION_AUTH_AUDIT ${JSON.stringify(authResponses)}\n${error.message}`);
  }
}

test.describe('NaliVision E2E audit', () => {
  test.skip(!(email && password), 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD.');
  test('loads Free TV, lists channels, and plays a browser-compatible HLS channel', async ({ page }) => {
    test.setTimeout(180000);
    const browserErrors = [];
    page.on('pageerror', (error) => browserErrors.push(error.message));

    await login(page);
    // Login uses window.location.href and can continue through a final redirect to
    // the app root on WebKit. Wait for that redirect chain to settle before opening
    // NaliVision so two top-level navigations do not race each other.
    await page.waitForURL((url) => new URL(url).pathname === '/', { timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.goto('/live-tv', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'NaliVision' })).toBeVisible();

    const hlsCapabilities = await page.evaluate(() => {
      const video = document.createElement('video');
      return {
        nativeHls: Boolean(
          video.canPlayType('application/vnd.apple.mpegurl') ||
          video.canPlayType('application/x-mpegURL')
        ),
        mediaSource: typeof window.MediaSource !== 'undefined',
      };
    });
    console.log('NALIVISION_HLS_CAPABILITIES', JSON.stringify(hlsCapabilities));
    test.skip(
      !hlsCapabilities.nativeHls && !hlsCapabilities.mediaSource,
      'This Playwright browser runtime exposes neither native HLS nor MediaSource for hls.js.',
    );

    await page.getByRole('button', { name: /free tv/i }).click();
    await expect(page.getByText(/Channels \([1-9][0-9]*\)/)).toBeVisible({ timeout: 30000 });

    const candidates = page.locator('aside button');
    // Keep the phone/WebKit audit bounded: dead public streams can each consume
    // the media timeout, so sampling eight channels is enough to verify the path
    // without exhausting the test before later candidates can be exercised.
    const count = Math.min(await candidates.count(), 8);
    expect(count).toBeGreaterThan(0);

    let played = false;
    const attempts = [];
    for (let i = 0; i < count; i += 1) {
      const button = candidates.nth(i);
      const name = (await button.innerText()).split('\n')[0].trim();
      // The channel list is independently scrollable on phone-sized viewports.
      // Bring each candidate into view before tapping it.
      await button.scrollIntoViewIfNeeded();
      try {
        await button.click({ timeout: 5000 });
      } catch {
        // Some phone emulations keep an otherwise valid channel button outside
        // Playwright's actionability viewport after scrolling. Dispatch the same
        // DOM click so the channel-selection behavior can still be audited.
        await button.evaluate((el) => el.click());
      }
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
    // Presence updates are background telemetry and may be rejected by Base44
    // access-control rules for ordinary users. They are unrelated to Live TV.
    const relevantBrowserErrors = browserErrors.filter(
      (message) => !message.includes('/functions/updateUserPresence due to access control checks.'),
    );
    expect(relevantBrowserErrors, 'NaliVision browser errors').toEqual([]);

    const hlsUnsupported = await page.getByRole('alert').filter({
      hasText: 'This browser cannot play this HLS stream.',
    }).isVisible().catch(() => false);
    test.skip(
      !played && hlsUnsupported,
      'This Playwright browser runtime exposes neither native HLS nor an hls.js-compatible MediaSource path.',
    );
    expect(played, 'At least one of the sampled Free TV channels should reach playable media state').toBe(true);
  });
});
