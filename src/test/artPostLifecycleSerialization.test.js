import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('ArtPost lifecycle serialization', () => {
  it('serializes ArtPost comment creation with post mutations/deletion', async () => {
    const comments = await readFile('base44/functions/trackComments/entry.ts', 'utf8');
    expect(comments).toContain("parentType === 'art_post'");
    expect(comments).toContain('acquireArtPostEngagementLock(entities, parentId)');
    expect(comments).toContain('releaseArtPostEngagementLock(entities, artPostLockId)');
  });

  it('serializes ArtPost edits and rechecks ownership under lock', async () => {
    const source = await readFile('base44/functions/mutateArtPost/entry.ts', 'utf8');
    const lock = source.indexOf('acquireArtPostEngagementLock(entities, postId)');
    const recheck = source.indexOf('currentPost.creator_id !== user.id', lock);
    const update = source.indexOf('ArtPost.update(currentPost.id, patch)', recheck);
    expect(lock).toBeGreaterThan(-1);
    expect(recheck).toBeGreaterThan(lock);
    expect(update).toBeGreaterThan(recheck);
  });

  it('serializes ArtPost deletion and cascade cleanup', async () => {
    const source = await readFile('base44/functions/deleteArtPost/entry.ts', 'utf8');
    const lock = source.indexOf('acquireArtPostEngagementLock(entities, normalizedPostId)');
    const comments = source.indexOf('TrackComment.filter(', lock);
    const deletion = source.indexOf('ArtPost.delete(currentPost.id)', comments);
    expect(lock).toBeGreaterThan(-1);
    expect(comments).toBeGreaterThan(lock);
    expect(deletion).toBeGreaterThan(comments);
    expect(source).toContain('releaseArtPostEngagementLock(entities, lockId)');
  });
});
