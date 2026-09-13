import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge submission lock duration', () => {
  it('keeps media validation outside the challenge lifecycle lock', async () => {
    const source = await readFile('base44/functions/submitChallengeRemix/entry.ts', 'utf8');
    const mediaCheck = source.indexOf('resolveStoredFileSize(remixFileUrl)');
    const lock = source.indexOf('acquireChallengeLifecycleLock(entities, challengeId)');
    const create = source.indexOf('entities.ChallengeSubmission.create({');
    expect(mediaCheck).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(mediaCheck);
    expect(create).toBeGreaterThan(lock);
    expect(source).toContain('const challengePreview = await entities.Challenge.get(challengeId)');
    expect(source).toContain('const lockedStateError = challengeSubmissionStateError(challenge)');
  });
});
