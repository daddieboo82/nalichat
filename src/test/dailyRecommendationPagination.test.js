import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('daily recommendation catalog pagination', () => {
  it('chooses daily picks from the full release catalog', async () => {
    const s = await readFile('src/components/home/DailyRecommendation.jsx', 'utf8');
    expect(s).toContain('async function listAllArtPosts()');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('ArtPost.list("-created_date", pageSize, skip)');
    expect(s).toContain('listAllArtPosts().then((posts) => {');
    expect(s).not.toContain('ArtPost.list("-created_date", 100)');
  });
});
