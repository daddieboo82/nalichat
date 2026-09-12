// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Settings action error handling', () => {
  it('surfaces avatar upload and profile save failures', async () => {
    const source = await readText('src/pages/Settings.jsx');
    expect(source).toContain('toast.error(error?.message || "Could not upload your profile photo.")');
    expect(source).toContain('toast.error(error?.message || "Could not save your profile. Please try again.")');
  });
});
