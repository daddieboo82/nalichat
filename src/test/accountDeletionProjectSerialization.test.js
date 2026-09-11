// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('account deletion project serialization', () => {
  it('locks project ownership transfers and collaborator removals', async () => {
    const source = await readText('base44/functions/deleteMyAccount/entry.ts');

    expect(source).toContain('withProjectMembershipLock');
    expect(source).toContain('acquireProjectMembershipLock');
    expect(source).toContain('releaseProjectMembershipLock');
    expect(source).toContain('Please retry account deletion.');
    expect(source.match(/withProjectMembershipLock\(entities, project\.id/g)?.length).toBe(2);
  });
});
