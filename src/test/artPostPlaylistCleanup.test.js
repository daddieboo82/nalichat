// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('ArtPost playlist cleanup', () => {
  it('targets playlists containing the deleted post instead of scanning all playlists', async () => {
    const source = await readText('base44/functions/deleteArtPost/entry.ts');

    expect(source).not.toContain('entities.Playlist.list()');
    expect(source).toContain('{ track_ids: post.id }');
    expect(source).toMatch(/Playlist\.filter\([\s\S]*'-created_date',[\s\S]*200/);
    expect(source).toContain('track_ids: trackIds.filter');
  });
});
