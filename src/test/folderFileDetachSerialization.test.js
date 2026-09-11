// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('folder file detach serialization', () => {
  it('locks each shared file before detaching it during folder deletion', async () => {
    const source = await readText('base44/functions/deleteFolder/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('folderId.length > 200');
    expect(source).toContain('acquireSharedFileMutationLock');
    expect(source).toContain('releaseSharedFileMutationLock');
    expect(source).toContain("current?.folder_id === folder.id");
    expect(source).toContain('status: 409');
  });
});
