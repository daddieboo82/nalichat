import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge submission lifecycle lock scope', () => {
  it('performs media validation before acquiring the final challenge lock', async () => {
    const source = await readFile('base44/functions/submitChallengeRemix/entry.ts', 'utf8');
    const sizeCheck = source.indexOf('resolveStoredFileSize(remixFileUrl)');
    const lock = source.indexOf('const challengeLockId = await acquireChallengeLifecycleLock(entities, challengeId)');
    const finalStateCheck = source.indexOf('const lockedStateError = challengeSubmissionStateError(challenge)');
    expect(sizeCheck).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(sizeCheck);
    expect(finalStateCheck).toBeGreaterThan(lock);
  });

  it('rechecks challenge submission state inside the lock before create', async () => {
    const source = await readFile('base44/functions/submitChallengeRemix/entry.ts', 'utf8');
    expect(source).toContain('challengeSubmissionStateError(challengePreview)');
    expect(source).toContain('challengeSubmissionStateError(challenge)');
    expect(source.indexOf('lockedStateError')).toBeLessThan(source.indexOf('entities.ChallengeSubmission.create({'));
  });
});
