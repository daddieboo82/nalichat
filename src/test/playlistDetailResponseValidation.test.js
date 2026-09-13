import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('playlist detail response validation', () => {
  it('requires confirmed playlist records after add/remove mutations', async () => {
    const s = await readFile('src/pages/PlaylistDetail.jsx', 'utf8');
    expect((s.match(/Playlist update was not confirmed/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(s).toContain('res?.data?.success !== true || !updatedPlaylist?.id');
  });
});
