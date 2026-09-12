import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('ArtPost deletion orphan cleanup', () => {
  it('deletes ArtPostPlay rows before deleting the post', async () => {
    const s = await readFile('base44/functions/deleteArtPost/entry.ts', 'utf8');
    const plays = s.indexOf('entities.ArtPostPlay.filter(');
    const postDelete = s.indexOf('entities.ArtPost.delete(currentPost.id)');
    expect(plays).toBeGreaterThan(-1);
    expect(postDelete).toBeGreaterThan(plays);
    expect(s).toContain('deleted_plays: deletedPlays');
  });
});
