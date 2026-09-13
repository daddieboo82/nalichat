import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('profile subquery error states', () => {
  it('does not show failed posts or achievements queries as empty profile data', async () => {
    const s = await readFile('src/pages/Profile.jsx', 'utf8');
    expect(s).toContain('isError: postsError');
    expect(s).toContain('isError: achievementsError');
    expect(s).toContain('Tracks unavailable');
    expect(s).toContain('Achievements unavailable');
    expect(s).toContain('refetchPosts');
    expect(s).toContain('refetchAchievements');
  });
});
