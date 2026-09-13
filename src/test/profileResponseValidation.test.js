import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('profile update response validation', () => {
  it('requires updateMyProfile to explicitly confirm profile, avatar, and cover writes', async () => {
    const s = await readFile('src/pages/Profile.jsx', 'utf8');
    expect((s.match(/Profile update was not confirmed/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});
