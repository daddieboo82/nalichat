// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('challenge leaderboard truncation UX', () => {
  it('surfaces backend truncation instead of presenting incomplete counts as exact', async () => {
    const source = await readText('src/pages/ChallengeLeaderboard.jsx');

    expect(source).toContain('setTruncated(res?.data?.truncated');
    expect(source).toContain('truncated.submissions');
    expect(source).toContain('truncated.weeklyVotes');
    expect(source).toContain('some rankings or vote totals may be incomplete');
  });
});
