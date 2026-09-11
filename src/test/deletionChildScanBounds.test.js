// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('deletion child scan bounds', () => {
  it('batches folder file detachment', async () => {
    const source = await readText('base44/functions/deleteFolder/entry.ts');
    expect(source).toMatch(/SharedFile\.filter\([\s\S]*'-created_date',[\s\S]*200/);
    expect(source).toContain('detachedFiles += 1');
  });

  it('batches challenge submission vote and comment cleanup', async () => {
    const source = await readText('base44/functions/deleteChallengeSubmission/entry.ts');
    expect(source).toMatch(/ChallengeVote\.filter\([\s\S]*'-created_date',[\s\S]*200/);
    expect(source).toMatch(/TrackComment\.filter\([\s\S]*'-created_date',[\s\S]*200/);
    expect(source).toContain('deletedVotes += 1');
    expect(source).toContain('deletedComments += 1');
  });

  it('batches full challenge deletion cascades', async () => {
    const source = await readText('base44/functions/deleteChallenge/entry.ts');
    expect(source).toContain('const DELETE_BATCH_SIZE = 200;');
    expect(source).toMatch(/ChallengeVote\.filter\([\s\S]*challenge_id: challenge\.id[\s\S]*DELETE_BATCH_SIZE/);
    expect(source).toMatch(/ChallengeSubmission\.filter\([\s\S]*challenge_id: challenge\.id[\s\S]*DELETE_BATCH_SIZE/);
    expect(source).toMatch(/TrackComment\.filter\([\s\S]*parent_type: 'challenge_submission'[\s\S]*DELETE_BATCH_SIZE/);
    expect(source).toContain('deleted_submissions: deletedSubmissions');
    expect(source).toContain('deleted_votes: deletedVotes');
  });

  it('batches studio track and ArtPost child cleanup', async () => {
    const track = await readText('base44/functions/mutateTrack/entry.ts');
    const post = await readText('base44/functions/deleteArtPost/entry.ts');

    expect(track).toContain('const DELETE_BATCH_SIZE = 200;');
    expect(track).toContain("entity.filter(query, '-created_date', DELETE_BATCH_SIZE)");
    expect(track).toContain('deleted_versions: deletedVersions');
    expect(post).toMatch(/TrackComment\.filter\([\s\S]*parent_type: 'art_post'[\s\S]*DELETE_BATCH_SIZE/);
    expect(post).toContain('deleted_comments: deletedComments');
  });
});
