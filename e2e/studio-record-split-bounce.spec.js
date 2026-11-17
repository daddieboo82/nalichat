import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const fakeMedia = process.env.E2E_FAKE_MEDIA === '1';

async function login(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL((u) => new URL(u).pathname !== '/login', { timeout: 30000 });
  await expect(page.locator('[data-testid="auth-state"][data-state="authenticated"]')).toBeAttached({ timeout: 30000 });
}

async function openDemoProject(page) {
  await page.goto('/studio');
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/studio');
  const welcome = page.getByRole('heading', { name: /welcome to studio/i });
  await expect(welcome).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: /load demo project/i }).click();
  await expect(welcome).toBeHidden({ timeout: 30000 });

  const clips = page.locator('[data-testid^="studio-audio-clip-"]');
  await expect(clips.first()).toBeVisible({ timeout: 30000 });
  return clips;
}

// Clicks the ruler at the horizontal middle of a clip, so the playhead lands
// strictly inside it at any zoom level (split ignores a playhead outside the clip).
async function seekIntoClip(page, clip) {
  const ruler = page.getByTestId('studio-timeline-ruler');
  await expect(ruler).toBeVisible({ timeout: 15000 });
  const rulerBox = await ruler.boundingBox();
  const clipBox = await clip.boundingBox();
  await page.mouse.click(clipBox.x + clipBox.width / 2, rulerBox.y + rulerBox.height / 2);
}

test.describe('Studio record, split and bounce', () => {
  test.skip(!(email && password), 'requires E2E credentials');
  // The Studio editor is a desktop DAW; the phone layout collapses its transport
  // and toolbar onto a different surface, so these flows are desktop-only.
  test.skip(({ isMobile }) => isMobile, 'Studio editor flows run on desktop');

  test('splits a clip at the playhead and undoes it', async ({ page }) => {
    await login(page);
    const clips = await openDemoProject(page);
    const before = await clips.count();

    await clips.first().click();
    await expect(clips.first()).toHaveAttribute('class', /border-primary/, { timeout: 10000 });
    await seekIntoClip(page, clips.first());

    await page.keyboard.press('Control+e');
    await expect(clips).toHaveCount(before + 1, { timeout: 10000 });

    await page.keyboard.press('Control+z');
    await expect(clips).toHaveCount(before, { timeout: 10000 });
  });

  test('records a take through an armed track', async ({ page }) => {
    test.skip(!fakeMedia, 'Set E2E_FAKE_MEDIA=1 to supply a fake microphone.');
    await page.context().grantPermissions(['microphone']);
    await login(page);
    await openDemoProject(page);

    const arm = page.getByRole('button', { name: /arm demo lead for recording/i });
    await arm.click();
    await expect(arm).toHaveAttribute('aria-pressed', 'true', { timeout: 10000 });

    const record = page.getByRole('button', { name: /^record \(r\)$/i });
    await record.click();
    await page.waitForTimeout(2500);
    await record.click();

    await expect(page.getByText(/recording saved!?/i)).toBeVisible({ timeout: 45000 });
  });

  test('opens the bounce export for the mix', async ({ page }) => {
    await login(page);
    await openDemoProject(page);

    await page.getByRole('button', { name: /^export$/i }).click();
    await page.getByRole('menuitem', { name: /export & publish/i }).click();

    const bounce = page.getByRole('dialog');
    await expect(bounce).toBeVisible({ timeout: 15000 });
    await expect(bounce.getByRole('button', { name: /export & publish track/i })).toBeVisible({ timeout: 15000 });
  });
});