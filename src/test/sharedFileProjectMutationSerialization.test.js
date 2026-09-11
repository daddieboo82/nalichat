// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('shared file project mutation serialization', () => {
  it('locks source and destination projects around project-scoped file mutations', async () => {
    const source = await readText('base44/functions/mutateSharedFile/entry.ts');

    expect(source).toContain('acquireProjectMembershipLock');
    expect(source).toContain('releaseProjectMembershipLock');
    expect(source).toContain('projectLockIds');
    expect(source).toContain('File project changed. Please retry.');
    expect(source).toContain('Destination project is being updated. Please retry.');
    expect(source).toContain('Folder destination changed. Please retry.');
    expect(source.indexOf('acquireProjectMembershipLock')).toBeLessThan(
      source.indexOf('SharedFile.update(file.id'),
    );
  });
});
