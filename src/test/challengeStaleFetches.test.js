// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('challenge route stale fetch protection', () => {
  it('cancels stale leaderboard fetch results', async () => {
    const source = await readText('src/pages/ChallengeLeaderboard.jsx');
    expect(source).toContain('let cancelled = false;');
    expect(source).toContain('if (!cancelled) setChallenge(nextChallenge);');
    expect(source).toContain('if (!cancelled) setSubmissions(nextSubmissions || []);');
    expect(source).toContain('cancelled = true;');
  });

  it('cancels stale submission and vote-status fetch results', async () => {
    const source = await readText('src/pages/SubmissionPlayer.jsx');
    expect(source).toContain('setSubmission(null);');
    expect(source).toMatch(/if \(!cancelled\) \{[\s\S]*setSubmission\(nextSubmission\);[\s\S]*\}/);
    expect(source).toContain('if (!cancelled) setHasVoted((votes || []).length > 0);');
    expect(source).toContain('cancelled = true;');
  });
});
