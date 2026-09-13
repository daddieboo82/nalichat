// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('challenge leaderboard bounds', () => {
  it('caps public challenge leaderboard service-role scans', async () => {
    const source = await readText('base44/functions/getChallengeLeaderboard/entry.ts');
    expect(source).toContain('MAX_LEADERBOARD_SUBMISSIONS = 500');
    expect(source).toMatch(/ChallengeSubmission\.filter\([\s\S]*MAX_LEADERBOARD_SUBMISSIONS/);
    expect(source).toContain('async function loadWeeklyVotes');
    expect(source).toContain('const pageSize = 500;');
    expect(source).toMatch(/entity\.filter\([\s\S]*pageSize,[\s\S]*skip/);
  });

  it('caps challenge client reads and one-vote existence checks', async () => {
    const leaderboard = await readText('src/pages/ChallengeLeaderboard.jsx');
    const detail = await readText('src/pages/ChallengeDetail.jsx');
    const player = await readText('src/pages/SubmissionPlayer.jsx');

    expect(leaderboard).toContain('MAX_LEADERBOARD_SUBMISSIONS = 500');
    expect(detail).toContain('async function filterAllRows');
    expect(detail).toMatch(/ChallengeSubmission[\s\S]*filterAllRows/);
    expect(detail).toMatch(/ChallengeVote[\s\S]*filterAllRows/);
    expect(player).toContain('async function listAllApprovedSubmissions');
    expect(player).toMatch(/ChallengeVote[\s\S]*"-created_date", 1/);
  });
});
