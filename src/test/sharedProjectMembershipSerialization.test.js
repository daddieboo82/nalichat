// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('shared project membership serialization', () => {
  it('uses the same lock for invite acceptance and owner collaborator mutations', async () => {
    const helper = await readText('base44/shared/projectMembershipLock.ts');
    expect(helper).toContain('MEMBERSHIP_LOCK_TTL_MS = 5 * 60 * 1000');
    expect(helper).toContain('ProjectMembershipLock.create');
    expect(helper).toContain('ProjectMembershipLock.delete');

    const accept = await readText('base44/functions/acceptProjectInvite/entry.ts');
    expect(accept).toContain('acquireProjectMembershipLock');
    expect(accept).toContain('releaseProjectMembershipLock');

    const manage = await readText('base44/functions/manageProjectCollaborator/entry.ts');
    expect(manage).toContain("req.method !== 'POST'");
    expect(manage).toContain('acquireProjectMembershipLock');
    expect(manage).toContain('releaseProjectMembershipLock');
    expect(manage).toContain('status: 409');
  });
});
