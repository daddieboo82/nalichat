// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('final rollback hardening', () => {
  it('reports project invite usage rollback failures', async () => {
    const source = await readText('base44/functions/acceptProjectInvite/entry.ts');
    expect(source).toContain('Project invite acceptance failed and usage rollback was incomplete. Please retry.');
    expect(source).not.toContain("used_count: -1 } },\n        ).catch(() => {});");
  });

  it('reports squad activity and reward rollback failures', async () => {
    const source = await readText('base44/functions/recordSquadActivity/entry.ts');
    expect(source).toContain('Squad reward credit update failed and rollback was incomplete. Please retry.');
    expect(source).toContain('Squad progress update failed and activity rollback was incomplete. Please retry.');
    expect(source).not.toContain('SquadReward.delete(rewardId).catch(() => {})');
    expect(source).not.toContain('SquadActivity.delete(ledgerId).catch(() => {})');
  });

  it('reports published-post reward rollback failures', async () => {
    const source = await readText('base44/functions/claimPublishedPostReward/entry.ts');
    expect(source).toContain('Post XP update failed and reward rollback was incomplete. Please retry.');
    expect(source).not.toContain('UserActivityReward.delete(rewardId).catch(() => {})');
  });
});
