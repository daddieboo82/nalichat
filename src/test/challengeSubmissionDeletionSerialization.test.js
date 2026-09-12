import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge submission deletion serialization', () => {
  it('locks submission before challenge lifecycle', async () => {
    const s = await readFile('base44/functions/deleteChallengeSubmission/entry.ts', 'utf8');
    const submissionLock = s.indexOf('acquireChallengeSubmissionLock(entities, submissionId)');
    const challengeLock = s.indexOf('acquireChallengeLifecycleLock(entities, submission.challenge_id)');
    expect(submissionLock).toBeGreaterThan(-1);
    expect(challengeLock).toBeGreaterThan(submissionLock);
  });

  it('rechecks challenge reference before challenge lock', async () => {
    const s = await readFile('base44/functions/deleteChallengeSubmission/entry.ts', 'utf8');
    const recheck = s.indexOf('submission.challenge_id !== submissionPreview.challenge_id');
    const challengeLock = s.indexOf('acquireChallengeLifecycleLock(entities, submission.challenge_id)');
    expect(recheck).toBeGreaterThan(-1);
    expect(challengeLock).toBeGreaterThan(recheck);
  });

  it('releases challenge lock before submission lock', async () => {
    const s = await readFile('base44/functions/deleteChallengeSubmission/entry.ts', 'utf8');
    const releaseChallenge = s.indexOf('releaseChallengeLifecycleLock(entities, challengeLockId)');
    const releaseSubmission = s.indexOf('releaseChallengeSubmissionLock(entities, lockId)', releaseChallenge);
    expect(releaseChallenge).toBeGreaterThan(-1);
    expect(releaseSubmission).toBeGreaterThan(releaseChallenge);
  });
});
