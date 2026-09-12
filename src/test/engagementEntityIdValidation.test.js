import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('engagement entity id validation', () => {
  it('validates vote submission ids before lookup', async () => {
    const s = await readFile('base44/functions/castVote/entry.ts', 'utf8');
    expect(s.indexOf('isBase44EntityId(submission_id.trim())')).toBeLessThan(s.indexOf('ChallengeSubmission.get(submission_id)'));
  });
  it('validates playlist and track ids before lookup', async () => {
    const s = await readFile('base44/functions/mutatePlaylist/entry.ts', 'utf8');
    expect(s).toContain('isBase44EntityId(playlistId)');
    expect(s).toContain('isBase44EntityId(trackId)');
  });
  it('validates art post ids before deletion lookup', async () => {
    const s = await readFile('base44/functions/deleteArtPost/entry.ts', 'utf8');
    expect(s.indexOf('isBase44EntityId(normalizedPostId)')).toBeLessThan(s.indexOf('ArtPost.get(normalizedPostId)'));
  });
});
