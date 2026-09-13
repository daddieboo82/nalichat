import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Explore catalog pagination', () => {
  it('loads all releases before client-side search and medium filtering', async () => {
    const s = await readFile('src/pages/Explore.jsx', 'utf8');
    expect(s).toContain('async function listAllArtPosts(filter)');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('ArtPost.list("-created_date", pageSize, skip)');
    expect(s).toContain('ArtPost.filter({ medium: filter }, "-created_date", pageSize, skip)');
    expect(s).toContain('listAllArtPosts(filter)');
    expect(s).not.toContain('ArtPost.list("-created_date", 100)');
  });
});
