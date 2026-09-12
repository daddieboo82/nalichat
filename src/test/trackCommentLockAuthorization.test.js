import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('track comment lock authorization ordering', () => {
  it('authenticates and rate-limits comment creation before mutation locks', async () => {
    const source = await readFile('base44/functions/trackComments/entry.ts', 'utf8');
    const auth = source.indexOf("if (!user?.id) return Response.json({ error: 'Sign in to comment' }");
    const rate = source.indexOf("'track_comment'");
    const submissionLock = source.indexOf('acquireChallengeSubmissionLock(entities, parentId)');
    const trackLock = source.indexOf('acquireTrackLifecycleLock(entities, parentId)');
    expect(auth).toBeGreaterThan(-1);
    expect(rate).toBeGreaterThan(-1);
    expect(auth).toBeLessThan(submissionLock);
    expect(auth).toBeLessThan(trackLock);
    expect(rate).toBeLessThan(submissionLock);
    expect(rate).toBeLessThan(trackLock);
  });
});
