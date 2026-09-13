import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('analytics catalog pagination', () => {
  it('loads the full creator catalog before computing lifetime analytics', async () => {
    const s = await readFile('src/pages/Analytics.jsx', 'utf8');
    expect(s).toContain('async function listAllUserPosts(userId)');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('listAllUserPosts(currentUser.id)');
    expect(s).not.toContain('ArtPost.filter({ creator_id: currentUser.id }, "-created_date", 100)');
    expect(s).toContain('{ label: "Tracks Uploaded", value: userPosts.length');
  });
});
