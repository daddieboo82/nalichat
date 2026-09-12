// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('project invite membership serialization', () => {
  it('serializes membership mutations with stale-lock recovery', async () => {
    const source = await readText('base44/functions/acceptProjectInvite/entry.ts');
    const lock = await readText('base44/shared/projectMembershipLock.ts');
    const schema = JSON.parse(await readText('base44/entities/ProjectMembershipLock.jsonc'));

    expect(source).toContain('acquireProjectMembershipLock');
    expect(source).toContain('releaseProjectMembershipLock');
    expect(lock).toContain('MEMBERSHIP_LOCK_TTL_MS = 5 * 60 * 1000');
    expect(lock).toContain('ProjectMembershipLock.create');
    expect(lock).toContain('ProjectMembershipLock.get');
    expect(lock).toContain('ProjectMembershipLock.delete(lockId)');
    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('status: 409');
    expect(schema.rls.read?.user_condition?.role).toBe('admin');
  });
});
