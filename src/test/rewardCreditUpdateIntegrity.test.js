import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

// Service-role bulk updates to User are forbidden, so XP and credits are written
// to the verified account only. These assertions keep that scoping plus the
// dedupe-rollback guarantee that makes a failed credit retryable.
describe('reward credit update integrity', () => {
  it('awards published-post XP to the verified account only', async () => {
    const s = await readFile('base44/functions/claimPublishedPostReward/entry.ts', 'utf8');
    expect(s).toContain('const currentUser = await entities.User.get(user.id)');
    expect(s).toContain('if (!currentUser || currentUser.id !== user.id)');
    expect(s).toContain('await entities.User.update(user.id,');
    expect(s).not.toContain('entities.User.updateMany');
    expect(s).toContain('entities.UserActivityReward.delete(rewardId)');
  });

  it('requires exactly one user and progress row for squad rewards', async () => {
    const s = await readFile('base44/functions/recordSquadActivity/entry.ts', 'utf8');
    expect(s).toContain('const currentUser = await entities.User.get(userId)');
    expect(s).toContain('if (!currentUser || currentUser.id !== userId)');
    expect(s).toContain('await entities.User.update(userId,');
    expect(s).not.toContain('entities.User.updateMany');
    expect(s).toContain('const progressUpdate = await entities.SquadProgress.updateMany');
    expect(s).toContain('Number(progressUpdate?.updated || 0) !== 1');
    expect(s).toContain('entities.SquadReward.delete(rewardId)');
    expect(s).toContain('entities.SquadActivity.delete(ledgerId)');
  });
});