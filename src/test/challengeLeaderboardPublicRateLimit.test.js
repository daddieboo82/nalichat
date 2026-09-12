import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public leaderboard abuse protection', () => {
  it('rate limits uncached anonymous reads before challenge service-role lookup', async () => {
    const source = await readFile('base44/functions/getChallengeLeaderboard/entry.ts', 'utf8');

    expect(source).toContain("import { consumeHourlyLimit } from '../../shared/rateLimit.ts';");
    expect(source).toContain("'challenge_leaderboard_read'");
    expect(source).toContain('240');
    expect(source).toContain('leaderboard_read_');
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(
      source.indexOf('entities.Challenge.get(challengeId)'),
    );
    expect(source).toContain("{ status: 429 }");
  });

  it('keeps cache hits ahead of the rate-limit write', async () => {
    const source = await readFile('base44/functions/getChallengeLeaderboard/entry.ts', 'utf8');

    expect(source.indexOf('leaderboardCache.get(challengeId)')).toBeLessThan(
      source.indexOf('consumeHourlyLimit('),
    );
  });
});
