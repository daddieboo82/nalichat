import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('liked post state pagination', () => {
  it('returns every liked post id instead of truncating at 1000', async () => {
    const s = await readFile('base44/functions/listMyLikedPostIds/entry.ts', 'utf8');
    expect(s).toContain('async function listAllLikedPosts(entity: any, userId: string)');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('{ liked_by: userId }');
    expect(s).toContain('const posts = await listAllLikedPosts(');
    expect(s).not.toContain("'-created_date',\n      1000,");
  });
});
