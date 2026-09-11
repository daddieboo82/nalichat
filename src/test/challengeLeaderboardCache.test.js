// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('public challenge leaderboard cache', () => {
  it('uses POST-only access, bounded warm caching, and in-flight coalescing', async () => {
    const source = await readText('base44/functions/getChallengeLeaderboard/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('const CACHE_TTL_MS = 15_000');
    expect(source).toContain('const MAX_CACHE_ENTRIES = 100');
    expect(source).toContain('leaderboardCache');
    expect(source).toContain('leaderboardInFlight');
    expect(source).toContain("'X-Nali-Cache': 'hit'");
    expect(source).toContain("'X-Nali-Cache': 'miss'");
    expect(source).toContain('leaderboardInFlight.delete(challengeId)');
  });
});
