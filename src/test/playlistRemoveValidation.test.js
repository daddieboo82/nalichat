import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('playlist remove-track validation', () => {
  it('requires mutatePlaylist to confirm removal before success feedback', async () => {
    const s = await readFile('src/pages/PlaylistDetail.jsx', 'utf8');
    expect(s).toContain('res?.data?.action !== "remove_track"');
    expect(s).toContain('res?.data?.userId !== currentUser?.id');
    expect(s).toContain('res?.data?.playlistId !== playlistId');
    expect(s).toContain('updatedPlaylist?.id !== playlistId');
    expect(s).toContain('updatedPlaylist.track_ids.includes(trackId)');
  });
});
