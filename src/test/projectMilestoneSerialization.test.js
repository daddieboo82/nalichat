// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('project milestone serialization', () => {
  it('serializes milestone create/toggle/delete with project lifecycle mutations', async () => {
    const create = await readText('base44/functions/createProjectMilestone/entry.ts');
    expect(create).toContain("req.method !== 'POST'");
    expect(create).toContain('acquireProjectMembershipLock');
    expect(create).toContain('releaseProjectMembershipLock');
    expect(create).toContain('body.title.length > 200');
    expect(create).toContain('body.description.length > 1000');
    expect(create).not.toContain('slice(0, 200)');
    expect(create).not.toContain('slice(0, 1000)');

    const mutate = await readText('base44/functions/mutateMilestone/entry.ts');
    expect(mutate).toContain("req.method !== 'POST'");
    expect(mutate).toContain('isBase44EntityId(milestoneId)');
    expect(mutate).toContain('acquireProjectMembershipLock');
    expect(mutate).toContain('const currentMilestone = await entities.Milestone.get(milestone.id)');
    expect(mutate).toContain('const completed = !currentMilestone.completed');
    expect(mutate).toContain('releaseProjectMembershipLock');
  });
});
