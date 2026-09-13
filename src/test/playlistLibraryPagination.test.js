import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('playlist library pagination', () => {
  it('loads every owned playlist in bounded pages', async () => {
    const s = await readFile('src/pages/Playlists.jsx', 'utf8');
    expect(s).toContain('async function listAllOwnedPlaylists(userId)');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('{ owner_id: userId }');
    expect(s).toContain('listAllOwnedPlaylists(currentUser.id)');
    expect(s).not.toContain('Playlist.filter({ owner_id: currentUser.id }, "-created_date")');
  });
});
