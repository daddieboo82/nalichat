import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('project mutation lock scope', () => {
  it('validates and builds the patch before acquiring the project lock', async () => {
    const s = await readFile('base44/functions/mutateProject/entry.ts', 'utf8');
    const patch = s.indexOf('const patch: Record<string, unknown> = {}');
    const supported = s.indexOf("Object.keys(patch).length === 0");
    const lock = s.indexOf('const lockId = await acquireProjectMembershipLock');
    expect(patch).toBeGreaterThan(-1);
    expect(supported).toBeGreaterThan(patch);
    expect(lock).toBeGreaterThan(supported);
  });
  it('still rechecks edit authorization after lock acquisition', async () => {
    const s = await readFile('base44/functions/mutateProject/entry.ts', 'utf8');
    const lock = s.indexOf('const lockId = await acquireProjectMembershipLock');
    const canEdit = s.indexOf('const canEdit = user.role', lock);
    expect(canEdit).toBeGreaterThan(lock);
  });
});
