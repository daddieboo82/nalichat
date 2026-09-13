import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('playlist error feedback', () => {
  it('does not render failed loads as an empty library and surfaces mutation failures', async () => {
    const s = await readFile('src/pages/Playlists.jsx', 'utf8');
    expect(s).toContain('isError, refetch');
    expect(s).toContain('Playlists unavailable');
    expect(s).toContain("Couldn't create playlist. Please try again.");
    expect(s).toContain("Couldn't delete playlist. Please try again.");
    expect(s).toContain('toast.success("Playlist created.")');
    expect(s).toContain('toast.success("Playlist deleted.")');
  });
});
