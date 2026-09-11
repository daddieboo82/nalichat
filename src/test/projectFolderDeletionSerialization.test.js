// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('project folder deletion serialization', () => {
  it('locks the project and each file before destructive folder cleanup', async () => {
    const source = await readText('base44/functions/deleteFolder/entry.ts');

    expect(source).toContain('acquireProjectMembershipLock');
    expect(source).toContain('releaseProjectMembershipLock');
    expect(source).toContain('Folder project changed. Please retry.');
    expect(source).toContain('acquireSharedFileMutationLock');
    expect(source).toContain('releaseSharedFileMutationLock');
    expect(source).toContain('Project is being updated. Please retry.');
  });
});
