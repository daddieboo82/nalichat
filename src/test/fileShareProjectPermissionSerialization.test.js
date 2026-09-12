import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('file share project permission serialization', () => {
  it('acquires file lock before project membership lock', async () => {
    const s=await readFile('base44/functions/createFileShareLink/entry.ts','utf8');
    const fileLock=s.indexOf('const lockId = await acquireSharedFileMutationLock');
    const projectLock=s.indexOf('const projectLockId = file.project_id');
    expect(fileLock).toBeGreaterThan(-1);
    expect(projectLock).toBeGreaterThan(fileLock);
  });
  it('rechecks file parent and project permission before token write', async () => {
    const s=await readFile('base44/functions/createFileShareLink/entry.ts','utf8');
    const projectLock=s.indexOf('const projectLockId = file.project_id');
    const recheck=s.indexOf('const currentFile = await entities.SharedFile.get', projectLock);
    const auth=s.indexOf('let canShare = user.role', projectLock);
    const write=s.indexOf('entities.SharedFile.update(fileId', auth);
    expect(recheck).toBeGreaterThan(projectLock);
    expect(auth).toBeGreaterThan(recheck);
    expect(write).toBeGreaterThan(auth);
  });
});
