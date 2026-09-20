import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

async function login(page) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL((url) => new URL(url).pathname !== '/login', { timeout: 30000 });
  await expect(page.locator('[data-testid="auth-state"][data-state="authenticated"]')).toBeAttached({ timeout: 30000 });
}

test.describe('Studio clip dragging', () => {
  test.skip(!(email && password), 'Studio drag E2E requires authenticated E2E credentials.');

  test('waveform stays attached to the clip while dragging', async ({ page }) => {
    await login(page);
    await page.goto('/studio');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/studio');

    const welcome = page.getByRole('heading', { name: /welcome to studio/i });
    await expect(welcome).toBeVisible({ timeout: 30000 });
    const demoButton = page.getByRole('button', { name: /load demo project/i });
    await expect(demoButton).toBeVisible();
    await demoButton.click();
    await expect(welcome).toBeHidden({ timeout: 30000 });

    const clip = page.locator('[data-testid^="studio-audio-clip-"]').first();
    await expect(clip).toBeVisible({ timeout: 30000 });
    const trackId = await clip.getAttribute('data-track-id');
    const waveform = page.getByTestId(`studio-waveform-${trackId}`);
    await expect(waveform).toBeVisible();

    const clipBefore = await clip.boundingBox();
    const waveBefore = await waveform.boundingBox();
    expect(clipBefore).toBeTruthy();
    expect(waveBefore).toBeTruthy();
    const grabOffset = Math.min(80, Math.max(24, clipBefore.width * 0.3));
    const startX = clipBefore.x + grabOffset;
    const startY = clipBefore.y + clipBefore.height * 0.75;
    const dragX = 100;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + dragX, startY, { steps: 8 });

    const clipDuring = await clip.boundingBox();
    const waveDuring = await waveform.boundingBox();
    expect(clipDuring).toBeTruthy();
    expect(waveDuring).toBeTruthy();

    const clipDelta = clipDuring.x - clipBefore.x;
    const waveDelta = waveDuring.x - waveBefore.x;
    expect(Math.abs(clipDelta - dragX)).toBeLessThanOrEqual(3);
    expect(Math.abs(waveDelta - clipDelta)).toBeLessThanOrEqual(1);
    expect(Math.abs((clipDuring.x + grabOffset) - (startX + dragX))).toBeLessThanOrEqual(3);

    await page.mouse.up();

    const clipAfter = await clip.boundingBox();
    const waveAfter = await waveform.boundingBox();
    expect(Math.abs((waveAfter.x - waveBefore.x) - (clipAfter.x - clipBefore.x))).toBeLessThanOrEqual(1);
  });
});

