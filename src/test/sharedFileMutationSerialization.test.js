// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('shared file mutation serialization', () => {
  it('serializes share-link generation with file mutations', async () => {
    const helper = await readText('base44/shared/sharedFileMutationLock.ts');
    expect(helper).toContain('SHARED_FILE_LOCK_TTL_MS = 5 * 60 * 1000');
    expect(helper).toContain('SharedFileMutationLock.create');
    expect(helper).toContain('SharedFileMutationLock.delete');

    for (const path of [
      'base44/functions/createFileShareLink/entry.ts',
      'base44/functions/mutateSharedFile/entry.ts',
    ]) {
      const source = await readText(path);
      expect(source).toContain("req.method !== 'POST'");
      expect(source).toContain('acquireSharedFileMutationLock');
      expect(source).toContain('releaseSharedFileMutationLock');
      expect(source).toContain('status: 409');
      expect(
        source.includes('isBase44EntityId(fileId)')
        || source.includes('fileId.length > 200'),
      ).toBe(true);
    }
  });
});


describe('shared file mutation response identity contract', () => {
  it('binds update, move, and delete confirmations to the current user and file', async () => {
    const backend = await readText('base44/functions/mutateSharedFile/entry.ts');
    const files = await readText('src/pages/Files.jsx');
    expect(backend).toContain("action: 'delete'");
    expect(backend).toContain("action: 'update'");
    expect(backend).toContain("action: 'move'");
    expect(backend).toContain('userId: user.id');
    expect(files).toContain('res?.data?.userId !== currentUser?.id');
    expect(files).toContain('res?.data?.fileId !== id');
    expect(files).toContain('res?.data?.folderId !== folderId');
  });
});
