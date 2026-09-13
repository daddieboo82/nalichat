// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio master FX sync response binding', () => {
  it('accepts project autosave only for the active user, room, and master_fx field', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(source).toContain('res?.data?.action !== "update_project"');
    expect(source).toContain('res?.data?.userId !== user.id');
    expect(source).toContain('res?.data?.projectId !== roomId');
    expect(source).toContain('!res.data.updatedFields.includes("master_fx")');
    expect(source).toContain('Master FX sync was not confirmed.');
    expect(source).toContain('[masterFx, roomId, canEditProject, masterFxStorageKey, user?.id]');
  });
});
