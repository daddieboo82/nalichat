import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge leaderboard aggregation pagination', () => {
  it('keeps the submission display bounded while fully aggregating weekly votes', async () => {
    const s = await readFile('base44/functions/getChallengeLeaderboard/entry.ts', 'utf8');
    expect(s).toContain('const MAX_LEADERBOARD_SUBMISSIONS = 500');
    expect(s).toContain('async function loadWeeklyVotes(');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('loadWeeklyVotes(\n            entities.ChallengeVote');
    expect(s).toContain('weeklyVotes: false');
    expect(s).not.toContain('MAX_WEEKLY_VOTES');
  });
});
