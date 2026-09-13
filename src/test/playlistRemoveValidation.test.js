import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('playlist remove-track validation', () => {
  it('requires mutatePlaylist to confirm removal before success feedback', async () => {
    const s = await readFile('src/pages/PlaylistDetail.jsx', 'utf8');
    expect((s.match(/res\?\.data\?\.success !== true \|\| !updatedPlaylist\?\.id/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});
