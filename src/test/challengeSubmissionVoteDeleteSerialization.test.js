// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('challenge submission vote/delete serialization', () => {
  it('serializes voting and submission deletion on the same lock', async () => {
    const helper = await readText('base44/shared/challengeSubmissionLock.ts');
    expect(helper).toContain('SUBMISSION_LOCK_TTL_MS = 5 * 60 * 1000');
    expect(helper).toContain('ChallengeSubmissionLock.create');
    expect(helper).toContain('ChallengeSubmissionLock.delete');

    const vote = await readText('base44/functions/castVote/entry.ts');
    expect(vote).toContain("req.method !== 'POST'");
    expect(vote).toContain('acquireChallengeSubmissionLock');
    expect(vote).toContain('releaseChallengeSubmissionLock');

    const remove = await readText('base44/functions/deleteChallengeSubmission/entry.ts');
    expect(remove).toContain("req.method !== 'POST'");
    expect(remove).toContain('acquireChallengeSubmissionLock');
    expect(remove).toContain('releaseChallengeSubmissionLock');
    expect(remove).toContain('status: 409');
  });
});
