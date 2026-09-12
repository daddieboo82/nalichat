import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('project invite acceptance race safety', () => {
  it('revalidates the invite after acquiring the project membership lock', async () => {
    const s=await readFile('base44/functions/acceptProjectInvite/entry.ts','utf8');
    const lock=s.indexOf('const lockId = await acquireProjectMembershipLock');
    const refetch=s.indexOf('const lockedInvite = await base44.asServiceRole.entities.ProjectInvite.get', lock);
    const expiry=s.indexOf('new Date(lockedInvite.expires_at).getTime() < Date.now()', refetch);
    const claim=s.indexOf('ProjectInvite.updateMany', refetch);
    expect(refetch).toBeGreaterThan(lock);
    expect(expiry).toBeGreaterThan(refetch);
    expect(claim).toBeGreaterThan(expiry);
  });
  it('uses the locked invite role for membership and child sync', async () => {
    const s=await readFile('base44/functions/acceptProjectInvite/entry.ts','utf8');
    expect(s).toContain('[user.id]: lockedInvite.role');
    expect(s).toContain("if (lockedInvite.role === 'editor')");
    expect(s).toContain('{ success: true, role: lockedInvite.role }');
  });
});
