import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('add-to-playlist load state', () => {
  it('does not treat playlist query failure as an empty playlist library', async () => {
    const s = await readFile('src/components/explore/AddToPlaylistDialog.jsx', 'utf8');
    expect(s).toContain('isError: playlistsError');
    expect(s).toContain("Couldn't load your playlists");
    expect(s).toContain('refetchPlaylists');
    expect(s).toContain('!playlistsLoading && !playlistsError && playlists.length > 0');
  });
});
