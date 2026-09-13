import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('reward credit update integrity', () => {
  it('requires exactly one user row to receive published-post XP', async () => {
    const s = await readFile('base44/functions/claimPublishedPostReward/entry.ts', 'utf8');
    expect(s).toContain('const xpUpdate = await entities.User.updateMany');
    expect(s).toContain('Number(xpUpdate?.updated || 0) !== 1');
    expect(s).toContain('entities.UserActivityReward.delete(rewardId)');
  });

  it('requires exactly one user and progress row for squad rewards', async () => {
    const s = await readFile('base44/functions/recordSquadActivity/entry.ts', 'utf8');
    expect(s).toContain('const creditUpdate = await entities.User.updateMany');
    expect(s).toContain('Number(creditUpdate?.updated || 0) !== 1');
    expect(s).toContain('const progressUpdate = await entities.SquadProgress.updateMany');
    expect(s).toContain('Number(progressUpdate?.updated || 0) !== 1');
    expect(s).toContain('entities.SquadReward.delete(rewardId)');
    expect(s).toContain('entities.SquadActivity.delete(ledgerId)');
  });
});
