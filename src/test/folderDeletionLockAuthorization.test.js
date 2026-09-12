import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('folder deletion lock authorization', () => {
  it('authorizes folder deletion before acquiring the folder lock', async () => {
    const s = await readFile('base44/functions/deleteFolder/entry.ts', 'utf8');
    const preview = s.indexOf('const folderPreview = await entities.Folder.get(folderId)');
    const auth = s.indexOf('if (!previewCanEdit)');
    const lock = s.indexOf('const folderLockId = await acquireFolderMutationLock');
    expect(preview).toBeGreaterThan(-1);
    expect(auth).toBeGreaterThan(preview);
    expect(lock).toBeGreaterThan(auth);
  });

  it('rechecks the folder project after lock acquisition', async () => {
    const s = await readFile('base44/functions/deleteFolder/entry.ts', 'utf8');
    const lock = s.indexOf('const folderLockId = await acquireFolderMutationLock');
    const recheck = s.indexOf('Folder project changed. Please retry.', lock);
    expect(recheck).toBeGreaterThan(lock);
  });
});
