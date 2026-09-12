import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge comment lifecycle serialization', () => {
  it('acquires submission then challenge lock for submission comments', async () => {
    const s = await readFile('base44/functions/trackComments/entry.ts', 'utf8');
    const submissionLock = s.indexOf('acquireChallengeSubmissionLock(entities, parentId)');
    const challengeRef = s.indexOf('isBase44EntityId(submissionForLock.challenge_id)');
    const challengeLock = s.indexOf('acquireChallengeLifecycleLock(entities, submissionForLock.challenge_id)');
    expect(submissionLock).toBeGreaterThan(-1);
    expect(challengeRef).toBeGreaterThan(submissionLock);
    expect(challengeLock).toBeGreaterThan(challengeRef);
  });

  it('releases challenge lock before submission lock', async () => {
    const s = await readFile('base44/functions/trackComments/entry.ts', 'utf8');
    const releaseChallenge = s.indexOf('releaseChallengeLifecycleLock(entities, challengeLockId)');
    const releaseSubmission = s.indexOf('releaseChallengeSubmissionLock(entities, submissionLockId)', releaseChallenge);
    expect(releaseChallenge).toBeGreaterThan(-1);
    expect(releaseSubmission).toBeGreaterThan(releaseChallenge);
  });
});
