import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('submission player navigation pagination', () => {
  it('loads all approved submissions for previous/next navigation', async () => {
    const s = await readFile('src/pages/SubmissionPlayer.jsx', 'utf8');
    expect(s).toContain('async function listAllApprovedSubmissions(challengeId)');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('listAllApprovedSubmissions(challengeId)');
    expect(s).not.toContain('MAX_CHALLENGE_SUBMISSIONS');
  });
});
