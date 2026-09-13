import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Settings profile response validation', () => {
  it('requires updateMyProfile success before showing Profile updated', async () => {
    const s = await readFile('src/pages/Settings.jsx', 'utf8');
    expect(s).toContain('if (res?.data?.success !== true) throw new Error("Profile update was not confirmed");');
    expect(s).toContain('const refreshedUser = await checkUserAuth()');
    expect(s).toContain('refreshedUser.id !== user.id');
    expect(s).toContain('refreshedUser.display_name !== cleanedForm.display_name');
    expect(s).toContain('refreshedUser.avatar_url !== cleanedForm.avatar_url');
    expect(s).toContain('Profile saved, but your session did not refresh.');
  });
});
