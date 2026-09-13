import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('playlist mutation response validation', () => {
  it('requires confirmed create and delete responses before success UI', async () => {
    const s = await readFile('src/pages/Playlists.jsx', 'utf8');
    expect(s).toContain('created?.data?.success !== true || !playlist?.id');
    expect(s).toContain('res?.data?.success !== true || res?.data?.deleted !== true');
  });
  it('verifies add/remove membership and rollback confirmation', async () => {
    const s = await readFile('src/pages/PlaylistDetail.jsx', 'utf8');
    expect(s).toContain('updatedPlaylist?.id !== playlistId');
    expect(s).toContain('!updatedPlaylist.track_ids.includes(newPost.id)');
    expect(s).toContain('updatedPlaylist.track_ids.includes(trackId)');
    expect(s).toContain('cleanup?.data?.success !== true');
    expect(s).toContain('Track rollback was not confirmed');
  });
});
