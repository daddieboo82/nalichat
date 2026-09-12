import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('playlist mutation serialization', () => {
  it('uses a dedicated playlist mutation lock entity/helper', async () => {
    const entity=await readFile('base44/entities/PlaylistMutationLock.jsonc','utf8');
    const helper=await readFile('base44/shared/playlistMutationLock.ts','utf8');
    expect(entity).toContain('"name": "PlaylistMutationLock"');
    expect(helper).toContain('entities.PlaylistMutationLock.create');
    expect(helper).toContain('PLAYLIST_MUTATION_LOCK_TTL_MS');
  });
  it('authorizes before lock and rechecks ownership under lock', async () => {
    const s=await readFile('base44/functions/mutatePlaylist/entry.ts','utf8');
    const previewAuth=s.indexOf('playlistPreview.owner_id !== user.id');
    const lock=s.indexOf('const lockId = await acquirePlaylistMutationLock');
    const lockedAuth=s.indexOf('playlist.owner_id !== user.id', lock);
    expect(previewAuth).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(previewAuth);
    expect(lockedAuth).toBeGreaterThan(lock);
  });
  it('checks the 500-track limit from the locked playlist before add', async () => {
    const s=await readFile('base44/functions/mutatePlaylist/entry.ts','utf8');
    const lock=s.indexOf('const lockId = await acquirePlaylistMutationLock');
    const current=s.indexOf('const current = Array.isArray(playlist.track_ids)', lock);
    const limit=s.indexOf('current.length >= 500', current);
    const update=s.indexOf('$addToSet', limit);
    expect(current).toBeGreaterThan(lock);
    expect(limit).toBeGreaterThan(current);
    expect(update).toBeGreaterThan(limit);
  });
});
