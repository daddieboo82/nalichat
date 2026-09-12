import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('shared file patch lock scope', () => {
  it('validates update metadata before acquiring shared locks', async () => {
    const s = await readFile('base44/functions/mutateSharedFile/entry.ts', 'utf8');
    const patch = s.indexOf('let updatePatch: Record<string, any> | null = null');
    const lock = s.indexOf('folderLockId = await acquireFolderMutationLock');
    expect(patch).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(patch);
    expect(s.indexOf('No supported file fields supplied', patch)).toBeLessThan(lock);
  });
  it('keeps final authorization under the lock before update', async () => {
    const s = await readFile('base44/functions/mutateSharedFile/entry.ts', 'utf8');
    const lock = s.indexOf('fileLockId = await acquireSharedFileMutationLock');
    const auth = s.indexOf('let canEdit = user.role', lock);
    const update = s.indexOf('SharedFile.update(file.id, updatePatch', auth);
    expect(auth).toBeGreaterThan(lock);
    expect(update).toBeGreaterThan(auth);
  });
});
