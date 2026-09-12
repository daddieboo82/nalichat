import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge lock authorization ordering', () => {
  it('authorizes challenge status updates before lifecycle lock acquisition', async () => {
    const source = await readFile('base44/functions/updateChallengeStatus/entry.ts', 'utf8');
    expect(source).toContain('challengePreview');
    expect(source.indexOf('challengePreview')).toBeLessThan(source.indexOf('acquireChallengeLifecycleLock(entities, challengeId)'));
  });

  it('authorizes submission deletion before submission lock acquisition', async () => {
    const source = await readFile('base44/functions/deleteChallengeSubmission/entry.ts', 'utf8');
    expect(source).toContain('submissionPreview');
    expect(source.indexOf('submissionPreview')).toBeLessThan(source.indexOf('acquireChallengeSubmissionLock(entities, submissionId)'));
  });
});
