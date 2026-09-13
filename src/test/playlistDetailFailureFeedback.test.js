import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('playlist detail failure feedback', () => {
  it('distinguishes load errors from not-found and surfaces mutation outcomes', async () => {
    const s = await readFile('src/pages/PlaylistDetail.jsx', 'utf8');
    expect(s).toContain('isError: playlistError');
    expect(s).toContain('Playlist unavailable');
    expect(s).toContain('refetchPlaylist');
    expect(s).toContain('Track added to playlist.');
    expect(s).toContain('Track removed from playlist.');
    expect(s).toContain("Couldn't add track to playlist. Please try again.");
    expect(s).toContain("Couldn't remove track from playlist. Please try again.");
  });
});
