import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('file and folder lock authorization ordering', () => {
  it('authorizes file share links before file lock', async () => {
    const source = await readFile('base44/functions/createFileShareLink/entry.ts', 'utf8');
    expect(source.indexOf('filePreview')).toBeLessThan(source.indexOf('acquireSharedFileMutationLock('));
  });

  it('authorizes folder deletion before project lock', async () => {
    const source = await readFile('base44/functions/deleteFolder/entry.ts', 'utf8');
    expect(source.indexOf('previewCanEdit')).toBeLessThan(source.indexOf('acquireProjectMembershipLock('));
  });

  it('authorizes shared file mutations before file lock', async () => {
    const source = await readFile('base44/functions/mutateSharedFile/entry.ts', 'utf8');
    expect(source.indexOf('filePreview')).toBeLessThan(source.indexOf('acquireSharedFileMutationLock('));
  });
});
