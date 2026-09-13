import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('remix track picker pagination', () => {
  it('loads all published user tracks instead of only the newest 25', async () => {
    const s = await readFile('src/components/challenges/SubmitRemixModal.jsx', 'utf8');
    expect(s).toContain('async function listAllUserPosts(userId)');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('listAllUserPosts(user.id)');
    expect(s).not.toContain('ArtPost.filter({ creator_id: user.id }, "-created_date", 25)');
  });
});
