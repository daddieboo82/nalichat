import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge detail pagination', () => {
  it('loads all approved submissions and current-user votes', async () => {
    const s = await readFile('src/pages/ChallengeDetail.jsx', 'utf8');
    expect(s).toContain('async function filterAllRows(entity, query, sort, pageSize = 200)');
    expect(s).toContain('filterAllRows(\n        base44.entities.ChallengeSubmission');
    expect(s).toContain('filterAllRows(\n      base44.entities.ChallengeVote');
    expect(s).not.toContain('MAX_CHALLENGE_SUBMISSIONS');
    expect(s).not.toContain('MAX_USER_CHALLENGE_VOTES');
  });
});
