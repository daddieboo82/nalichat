import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('playlist detail response validation', () => {
  it('requires confirmed playlist records after add/remove mutations', async () => {
    const s = await readFile('src/pages/PlaylistDetail.jsx', 'utf8');
    expect((s.match(/Playlist update was not confirmed/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(s).toContain('res?.data?.action !== "add_track"');
    expect(s).toContain('res?.data?.action !== "remove_track"');
    expect((s.match(/res\?\.data\?\.userId !== currentUser\?\.id/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((s.match(/res\?\.data\?\.playlistId !== playlistId/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
