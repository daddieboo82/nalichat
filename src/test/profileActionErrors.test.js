// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('Profile action error handling', () => {
  it('surfaces profile save and image upload failures', async () => {
    const source = await readText('src/pages/Profile.jsx');
    expect(source).toContain('toast.error(error?.message || "Could not update your profile. Please try again.")');
    expect(source).toContain('toast.error(error?.message || "Could not update your profile photo.")');
    expect(source).toContain('toast.error(error?.message || "Could not update your profile cover.")');
    expect(source).toContain('toast.success("Profile updated.")');
  });
});
