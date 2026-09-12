// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('leaderboard request coalescing', () => {
  it('checks cache and joins in-flight work before challenge reads', async () => {
    const source = await readText('base44/functions/getChallengeLeaderboard/entry.ts');

    const cacheLookup = source.indexOf('const cached = leaderboardCache.get(challengeId)');
    const inFlightLookup = source.indexOf('leaderboardInFlight.get(challengeId)');
    const challengeRead = source.indexOf('entities.Challenge.get(challengeId)');

    expect(cacheLookup).toBeGreaterThan(-1);
    expect(inFlightLookup).toBeGreaterThan(cacheLookup);
    expect(challengeRead).toBeGreaterThan(inFlightLookup);
    expect(source).toContain("const payload = { error: 'Challenge not found' };");
    expect(source).toContain("return { ...payload, status: 404 };");
  });
});
