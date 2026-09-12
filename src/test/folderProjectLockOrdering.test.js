import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('folder/project lock ordering', () => {
  it('moves shared files with folder lock before project locks', async () => {
    const s = await readFile('base44/functions/mutateSharedFile/entry.ts', 'utf8');
    const folderLock = s.indexOf('folderLockId = await acquireFolderMutationLock');
    const projectLock = s.indexOf('const projectLockId = await acquireProjectMembershipLock');
    expect(folderLock).toBeGreaterThan(-1);
    expect(projectLock).toBeGreaterThan(folderLock);
    const projectRelease = s.indexOf('releaseProjectMembershipLock(entities, projectLockId)');
    const folderRelease = s.indexOf('releaseFolderMutationLock(entities, folderLockId)', projectRelease);
    expect(folderRelease).toBeGreaterThan(projectRelease);
  });

  it('creates folder-backed shared files with folder lock before project lock', async () => {
    const s = await readFile('base44/functions/createSharedFileRecord/entry.ts', 'utf8');
    const folderLock = s.indexOf('const folderLockId = folderId');
    const projectLock = s.indexOf('const projectLockId = destinationProjectId');
    expect(folderLock).toBeGreaterThan(-1);
    expect(projectLock).toBeGreaterThan(folderLock);
    const projectRelease = s.indexOf('releaseProjectMembershipLock(entities, projectLockId)');
    const folderRelease = s.indexOf('releaseFolderMutationLock(entities, folderLockId)', projectRelease);
    expect(folderRelease).toBeGreaterThan(projectRelease);
  });

  it('folder deletion uses the same folder then project order', async () => {
    const s = await readFile('base44/functions/deleteFolder/entry.ts', 'utf8');
    expect(s.indexOf('acquireFolderMutationLock(entities, folderId)'))
      .toBeLessThan(s.indexOf('acquireProjectMembershipLock(entities, folder.project_id)'));
  });
});
