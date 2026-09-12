import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('foreign reference race safety', () => {
  it('rechecks file project reference under lock', async () => {
    const s=await readFile('base44/functions/createFileShareLink/entry.ts','utf8');
    const lock=s.indexOf('const lockId = await acquireSharedFileMutationLock');
    expect(s.indexOf('File project changed. Please retry.',lock)).toBeGreaterThan(lock);
  });
  it('rechecks track-version project and track references under lock', async () => {
    const s=await readFile('base44/functions/deleteTrackVersion/entry.ts','utf8');
    const lock=s.indexOf('const lockId = await acquireTrackLifecycleLock');
    expect(s.indexOf('Track version references changed. Please retry.',lock)).toBeGreaterThan(lock);
  });
  it('rechecks milestone project reference under lock', async () => {
    const s=await readFile('base44/functions/mutateMilestone/entry.ts','utf8');
    const lock=s.indexOf('const lockId = await acquireProjectMembershipLock');
    expect(s.indexOf('Milestone project changed. Please retry.',lock)).toBeGreaterThan(lock);
  });
  it('rechecks vote challenge reference under submission lock', async () => {
    const s=await readFile('base44/functions/castVote/entry.ts','utf8');
    const lock=s.indexOf('const lockId = await acquireChallengeSubmissionLock');
    expect(s.indexOf('Submission challenge changed. Please retry.',lock)).toBeGreaterThan(lock);
  });
});
