import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('milestone permission race safety', () => {
  it('rechecks project edit permission after membership lock acquisition', async () => {
    const s=await readFile('base44/functions/mutateMilestone/entry.ts','utf8');
    const lock=s.indexOf('const lockId = await acquireProjectMembershipLock');
    const project=s.indexOf('const lockedProject = await entities.Project.get', lock);
    const auth=s.indexOf('const lockedCanEdit = user.role', project);
    const mutate=Math.min(
      ...['entities.Milestone.delete', 'entities.Milestone.update']
        .map((m)=>s.indexOf(m, auth))
        .filter((i)=>i>=0),
    );
    expect(project).toBeGreaterThan(lock);
    expect(auth).toBeGreaterThan(project);
    expect(mutate).toBeGreaterThan(auth);
  });
});
