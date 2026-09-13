import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('leaderboard catalog pagination', () => {
  it('loads the full art-post catalog before computing rankings', async () => {
    const s = await readFile('src/pages/Leaderboard.jsx', 'utf8');
    expect(s).toContain('async function listAllArtPosts()');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('ArtPost.list("-created_date", pageSize, skip)');
    expect(s).toContain('queryFn: listAllArtPosts');
    expect(s).not.toContain('ArtPost.list("-created_date", 200)');
  });
});
