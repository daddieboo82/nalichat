import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('shared file total lock ordering', () => {
  it('acquires folder before project locks and project locks before file lock', async () => {
    const s = await readFile('base44/functions/mutateSharedFile/entry.ts', 'utf8');
    const folder = s.indexOf('folderLockId = await acquireFolderMutationLock');
    const project = s.indexOf('const projectLockId = await acquireProjectMembershipLock');
    const file = s.indexOf('fileLockId = await acquireSharedFileMutationLock');
    expect(folder).toBeGreaterThan(-1);
    expect(project).toBeGreaterThan(folder);
    expect(file).toBeGreaterThan(project);
  });

  it('locks project ids in deterministic sorted order', async () => {
    const s = await readFile('base44/functions/mutateSharedFile/entry.ts', 'utf8');
    expect(s).toContain("])).sort();");
    expect(s).toContain('for (const projectId of projectIdsToLock)');
  });

  it('releases file then projects then folder in reverse order', async () => {
    const s = await readFile('base44/functions/mutateSharedFile/entry.ts', 'utf8');
    const fileRelease = s.indexOf('releaseSharedFileMutationLock(entities, fileLockId)');
    const projectRelease = s.indexOf('releaseProjectMembershipLock(entities, projectLockId)', fileRelease);
    const folderRelease = s.indexOf('releaseFolderMutationLock(entities, folderLockId)', projectRelease);
    expect(fileRelease).toBeGreaterThan(-1);
    expect(projectRelease).toBeGreaterThan(fileRelease);
    expect(folderRelease).toBeGreaterThan(projectRelease);
  });

  it('rechecks file and folder parent references under lock', async () => {
    const s = await readFile('base44/functions/mutateSharedFile/entry.ts', 'utf8');
    expect(s).toContain('File project changed. Please retry.');
    expect(s).toContain('Folder destination changed. Please retry.');
  });
});
