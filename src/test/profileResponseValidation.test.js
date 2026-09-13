import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('profile update response validation', () => {
  it('requires updateMyProfile to explicitly confirm profile, avatar, and cover writes', async () => {
    const s = await readFile('src/pages/Profile.jsx', 'utf8');
    expect((s.match(/Profile update was not confirmed/g) || []).length).toBeGreaterThanOrEqual(3);
    expect(s).toContain('const refreshedUser = await checkUserAuth()');
    expect(s).toContain('refreshedUser.id !== submittingUserId');
    expect((s.match(/refreshedUser\.id !== uploadOwnerId/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(s).toContain('refreshedUser.avatar_url !== file_url');
    expect(s).toContain('refreshedUser.cover_url !== file_url');
  });
});
