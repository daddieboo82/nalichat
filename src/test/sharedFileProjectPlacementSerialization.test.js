// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('shared file project placement serialization', () => {
  it('locks the destination project and revalidates folder placement before create', async () => {
    const source = await readText('base44/functions/createSharedFileRecord/entry.ts');

    expect(source).toContain('acquireProjectMembershipLock');
    expect(source).toContain('releaseProjectMembershipLock');
    expect(source).toContain('destinationProjectId');
    expect(source).toContain('Folder destination changed. Please retry.');
    expect(source).toContain('Project is being updated. Please retry.');
    expect(source.indexOf('acquireProjectMembershipLock')).toBeLessThan(
      source.indexOf('SharedFile.create'),
    );
  });
});
