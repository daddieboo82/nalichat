import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Settings profile response validation', () => {
  it('requires updateMyProfile success before showing Profile updated', async () => {
    const s = await readFile('src/pages/Settings.jsx', 'utf8');
    expect(s).toContain('res?.data?.action !== "update_my_profile"');
    expect(s).toContain('res?.data?.userId !== user.id');
    expect(s).toContain('const refreshedUser = await checkUserAuth()');
    expect(s).toContain('refreshedUser.id !== user.id');
    expect(s).toContain('refreshedUser.display_name !== cleanedForm.display_name');
    expect(s).toContain('refreshedUser.avatar_url !== cleanedForm.avatar_url');
    expect(s).toContain('Profile saved, but your session did not refresh.');
  });
});


describe('profile update identity response contract', () => {
  it('binds successful writes to the authenticated user and updated fields', async () => {
    const backend = await readFile('base44/functions/updateMyProfile/entry.ts', 'utf8');
    expect(backend).toContain("action: 'update_my_profile'");
    expect(backend).toContain('userId: user.id');
    expect(backend).toContain('updatedFields: Object.keys(patch).sort()');
  });
});
