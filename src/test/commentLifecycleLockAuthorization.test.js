import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('comment lifecycle lock authorization', () => {
  it('pre-authorizes create access before acquiring track/submission locks', async () => {
    const s = await readFile('base44/functions/trackComments/entry.ts', 'utf8');
    const preview = s.indexOf('const previewAccess = await canAccessParent');
    const submissionLock = s.indexOf('submissionLockId = await acquireChallengeSubmissionLock');
    const trackLock = s.indexOf('trackLockId = await acquireTrackLifecycleLock');
    expect(preview).toBeGreaterThan(-1);
    expect(preview).toBeLessThan(submissionLock);
    expect(preview).toBeLessThan(trackLock);
  });
  it('rechecks target access after lock acquisition', async () => {
    const s = await readFile('base44/functions/trackComments/entry.ts', 'utf8');
    const trackLock = s.indexOf('trackLockId = await acquireTrackLifecycleLock');
    const recheck = s.indexOf('const access = await canAccessParent', trackLock);
    expect(recheck).toBeGreaterThan(trackLock);
  });
});
