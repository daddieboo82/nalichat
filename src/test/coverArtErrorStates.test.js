import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Cover Art error states', () => {
  it('distinguishes query failures from empty content and surfaces save failures', async () => {
    const s = await readFile('src/pages/CoverArt.jsx', 'utf8');
    expect(s).toContain('isError: postsError');
    expect(s).toContain('isError: filesError');
    expect(s).toContain('isError: playlistsError');
    expect(s).toContain("Couldn't load your tracks");
    expect(s).toContain("Couldn't load your Files");
    expect(s).toContain("Couldn't load your playlists");
    expect(s).toContain('Failed to save cover art. Please try again.');
  });
});
