import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('engagement and lock-order hardening', () => {
  it('rate-limits art post play tracking before post reads', async () => {
    const source = await readFile('base44/functions/recordArtPostPlay/entry.ts', 'utf8');
    expect(source).toContain("'art_post_play'");
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(source.indexOf('entities.ArtPost.get(postId)'));
  });

  it('rate-limits and pre-validates votes before locks', async () => {
    const source = await readFile('base44/functions/castVote/entry.ts', 'utf8');
    expect(source).toContain("'challenge_vote'");
    expect(source).toContain('submissionPreview');
    expect(source).toContain('challengePreview');
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(source.indexOf('acquireChallengeSubmissionLock(entities, submission_id)'));
    expect(source.indexOf('submissionPreview')).toBeLessThan(source.indexOf('acquireChallengeSubmissionLock(entities, submission_id)'));
  });

  it('authorizes collaborative track creation before project lock', async () => {
    const source = await readFile('base44/functions/createCollaborativeTrack/entry.ts', 'utf8');
    expect(source).toContain('previewCanEdit');
    expect(source.indexOf('previewCanEdit')).toBeLessThan(source.indexOf('acquireProjectMembershipLock(entities, projectId)'));
  });

  it('authorizes challenge deletion before lifecycle lock', async () => {
    const source = await readFile('base44/functions/deleteChallenge/entry.ts', 'utf8');
    expect(source).toContain('challengePreview');
    expect(source.indexOf('challengePreview')).toBeLessThan(source.indexOf('acquireChallengeLifecycleLock(entities, challengeId)'));
  });
});
