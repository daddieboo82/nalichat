// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('PlaylistDetail user-scoped caches', () => {
  it('isolates playlist and track caches across auth changes', async () => {
    const source = await readText('src/pages/PlaylistDetail.jsx');

    expect(source).toContain('queryKey: ["playlist", currentUser?.id || "anonymous", playlistId]');
    expect(source).toContain('queryKey: ["playlistTracks", currentUser?.id || "anonymous", playlist?.track_ids]');
    expect(source).toContain('queryKey: ["playlistTracks", currentUser?.id || "anonymous"]');
    expect(source).not.toContain('queryKey: ["playlist", playlistId]');
  });
});
