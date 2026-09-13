import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('playlist mutation response validation', () => {
  it('requires confirmed create and delete responses before success UI', async () => {
    const s = await readFile('src/pages/Playlists.jsx', 'utf8');
    expect(s).toContain('if (!playlist?.id) throw new Error("Playlist creation was not confirmed");');
    expect(s).toContain('if (res?.data?.success !== true) throw new Error("Playlist deletion was not confirmed");');
  });
});
