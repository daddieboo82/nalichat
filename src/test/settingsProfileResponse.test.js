import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Settings profile response validation', () => {
  it('requires updateMyProfile success before showing Profile updated', async () => {
    const s = await readFile('src/pages/Settings.jsx', 'utf8');
    expect(s).toContain('res?.data?.action !== "update_my_profile"');
    expect(s).toContain('res?.data?.userId !== submittingUserId');
    expect(s).toContain('const refreshedUser = await checkUserAuth()');
    expect(s).toContain('refreshedUser.id !== submittingUserId');
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


describe('Settings in-flight account binding', () => {
  it('does not apply upload/save completion after the active account changes', async () => {
    const s = await readFile('src/pages/Settings.jsx', 'utf8');
    expect(s).toContain('const uploadOwnerId = user?.id');
    expect(s).toContain('activeUserIdRef.current !== uploadOwnerId');
    expect(s).toContain('const submittingUserId = user?.id');
    expect(s).toContain('formOwnerId !== submittingUserId');
    expect(s).toContain('activeUserIdRef.current !== submittingUserId');
  });
});


describe('Profile upload response scope', () => {
  it('uses the upload owner id for avatar and cover mutation validation', async () => {
    const s = await readFile('src/pages/Profile.jsx', 'utf8');
    expect(s).toContain('res?.data?.userId !== uploadOwnerId');
    expect(s).not.toContain('res?.data?.userId !== submittingUserId');
  });
});
