import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('cover art library pagination', () => {
  it('loads all user files, playlists, and posts in bounded pages', async () => {
    const s = await readFile('src/pages/CoverArt.jsx', 'utf8');
    expect(s).toContain('async function filterAllRows(entity, query, sort = "-created_date")');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('filterAllRows(base44.entities.SharedFile, { uploader_id: currentUser.id })');
    expect(s).toContain('filterAllRows(base44.entities.Playlist, { owner_id: currentUser.id })');
    expect(s).toContain('filterAllRows(base44.entities.ArtPost, { creator_id: currentUser.id })');
  });
});
