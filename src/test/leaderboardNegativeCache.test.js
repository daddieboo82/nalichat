// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('leaderboard negative cache', () => {
  it('caches missing challenges with the same bounded short TTL', async () => {
    const source = await readText('base44/functions/getChallengeLeaderboard/entry.ts');

    expect(source).toContain('status?: number');
    expect(source).toContain('status: cached.status || 200');
    expect(source).toContain("const payload = { error: 'Challenge not found' }");
    expect(source).toContain('status: 404');
    expect(source).toContain('expiresAt: Date.now() + CACHE_TTL_MS');
  });
});
