import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('playlist and ArtPost lifecycle serialization', () => {
  it('locks the ArtPost before adding it to a playlist', async () => {
    const s = await readFile('base44/functions/mutatePlaylist/entry.ts', 'utf8');
    const artLock = s.indexOf('acquireArtPostEngagementLock(entities, trackId)');
    const playlistLock = s.indexOf('acquirePlaylistMutationLock(entities, playlistId)');
    const recheck = s.indexOf('ArtPost.get(trackId)', playlistLock);
    expect(artLock).toBeGreaterThan(-1);
    expect(playlistLock).toBeGreaterThan(artLock);
    expect(recheck).toBeGreaterThan(playlistLock);
  });

  it('locks every referenced ArtPost before creating a playlist', async () => {
    const s = await readFile('base44/functions/createPlaylist/entry.ts', 'utf8');
    const totalOrder = s.indexOf('const orderedTrackIds = [...trackIds].sort()');
    const lock = s.indexOf('acquireArtPostEngagementLock(entities, trackId)');
    const recheck = s.indexOf('ArtPost.get(trackId)', lock);
    const create = s.indexOf('Playlist.create({', recheck);
    const release = s.indexOf('releaseArtPostEngagementLock(entities, lockId)', create);

    expect(totalOrder).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(totalOrder);
    expect(recheck).toBeGreaterThan(lock);
    expect(create).toBeGreaterThan(recheck);
    expect(release).toBeGreaterThan(create);
  });

  it('uses atomic pull when removing deleted posts from playlists', async () => {
    const s = await readFile('base44/functions/deleteArtPost/entry.ts', 'utf8');
    expect(s).toContain('{ $pull: { track_ids: currentPost.id } }');
    expect(s).not.toContain('trackIds.filter((id: string) => id !== currentPost.id)');
  });
});
