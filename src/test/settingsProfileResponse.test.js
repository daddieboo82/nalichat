import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Settings profile response validation', () => {
  it('requires updateMyProfile success before showing Profile updated', async () => {
    const s = await readFile('src/pages/Settings.jsx', 'utf8');
    expect(s).toContain('if (res?.data?.success !== true) throw new Error("Profile update was not confirmed");');
  });
});
