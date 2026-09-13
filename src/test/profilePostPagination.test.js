import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('profile post pagination', () => {
  it('loads all profile posts before computing gallery and totals', async () => {
    const s = await readFile('src/pages/Profile.jsx', 'utf8');
    expect(s).toContain('async function listAllUserPosts(userId)');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('{ creator_id: userId }');
    expect(s).toContain('listAllUserPosts(user.id)');
    expect(s).not.toContain('ArtPost.filter({ creator_id: user.id }, "-created_date")');
  });
});
