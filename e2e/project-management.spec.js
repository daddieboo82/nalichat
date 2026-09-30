import { expect, test } from '@playwright/test';

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const authenticated = Boolean(email && password);

async function login(page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await page.waitForURL((u) => new URL(u).pathname !== '/login', { timeout: 30000 });
  await expect(page.locator('[data-testid="auth-state"][data-state="authenticated"]')).toBeAttached({ timeout: 30000 });
  await expect(page.getByText('Loading app...', { exact: true })).toBeHidden({ timeout: 30000 });
  await page.waitForTimeout(750);
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

function filterNoise(errors) {
  return errors.filter(
    (x) =>
      !/favicon|Failed to load resource.*(?:401|404)|Public settings check failed:.*404|ERR_ABORTED|NS_BINDING_ABORTED|Load request cancelled/is.test(
        x,
      ),
  );
}

test.describe('project management workflows', () => {
  test.skip(!authenticated, 'Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run project management E2E.');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('projects summary renders project list and new-project dialog', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/projects-summary');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/projects-summary');
    await expect(page.getByRole('heading', { name: /projects/i }).first()).toBeVisible({ timeout: 30000 });

    // Open the new-project dialog via the button
    const newBtn = page.getByRole('button', { name: /new project/i }).first();
    if (await newBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newBtn.click();
      await expect(page.getByText(/project title/i).first()).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole('button', { name: /cancel/i }).first()).toBeVisible();
      await page.keyboard.press('Escape');
    }

    expect(filterNoise(errors)).toEqual([]);
  });

  test('creates a project and navigates to studio', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/projects-summary?new=true');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/projects-summary');

    const titleInput = page.getByPlaceholder(/project title|title/i).first();
    await expect(titleInput).toBeVisible({ timeout: 10000 });

    const projectTitle = `E2E Project ${Date.now()}`;
    await titleInput.fill(projectTitle);

    const createBtn = page.getByRole('button', { name: /^create$/i }).first();
    await createBtn.click();

    // The page navigates to /studio?room=<id> on success
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/studio');
    await expect.poll(() => new URL(page.url()).searchParams.get('room'), { timeout: 10000 }).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('challenge hub renders challenge cards or empty state', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/challenges');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/challenges');
    await expect(page.locator('body')).toBeVisible();

    // Either challenge cards render or the empty state is visible — both are valid.
    const hasCards = await page.locator('[class*="rounded"]').first().isVisible({ timeout: 10000 }).catch(() => false);
    const hasHeading = await page.getByRole('heading').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasCards || hasHeading).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('explore page renders published content surface', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/explore');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/explore');
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 });

    // The explore page should show either tracks or an empty state, not a blank screen.
    const hasContent = await page.getByRole('heading').first().isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();

    expect(filterNoise(errors)).toEqual([]);
  });

  test('playlists page renders and create-playlist dialog opens', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/playlists');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/playlists');
    await expect(page.getByRole('heading', { name: /your playlists/i })).toBeVisible({ timeout: 10000 });

    // Open the create dialog
    await page.getByRole('button', { name: /create playlist/i }).click();
    await expect(page.getByRole('heading', { name: /^create playlist$/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByPlaceholder(/my awesome mix/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^create$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();

    // Close dialog
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('heading', { name: /^create playlist$/i })).toBeHidden({ timeout: 5000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('creates and deletes a playlist end-to-end', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/playlists');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/playlists');
    await expect(page.getByRole('heading', { name: /your playlists/i })).toBeVisible({ timeout: 10000 });

    // Create a playlist
    const playlistName = `E2E Playlist ${Date.now()}`;
    await page.getByRole('button', { name: /create playlist/i }).click();
    await expect(page.getByPlaceholder(/my awesome mix/i)).toBeVisible({ timeout: 5000 });
    await page.getByPlaceholder(/my awesome mix/i).fill(playlistName);
    await page.getByRole('button', { name: /^create$/i }).click();

    // Wait for the playlist card to appear
    const card = page.getByText(playlistName, { exact: true }).first();
    await expect(card).toBeVisible({ timeout: 15000 });

    // Delete the playlist
    const deleteBtn = card.locator('..').getByRole('button', { name: /delete playlist/i }).first();
    await deleteBtn.click();

    // Confirm the playlist is gone
    await expect(card).toBeHidden({ timeout: 15000 });

    expect(filterNoise(errors)).toEqual([]);
  });

  test('studio loads demo project with transport controls', async ({ page }) => {
    const errors = collectErrors(page);

    await page.goto('/studio');
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 30000 }).toBe('/studio');

    const welcome = page.getByRole('heading', { name: /welcome to studio/i });
    await expect(welcome).toBeVisible({ timeout: 30000 });

    await page.getByRole('button', { name: /load demo project/i }).click();
    await expect(welcome).toBeHidden({ timeout: 30000 });

    await expect(page.getByRole('button', { name: /play\/pause/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /record/i })).toBeVisible();

    const clip = page.locator('[data-testid^="studio-audio-clip-"]').first();
    await expect(clip).toBeVisible({ timeout: 30000 });

    expect(filterNoise(errors)).toEqual([]);
  });
});