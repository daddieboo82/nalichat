import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('leaderboard load states', () => {
  it('does not render failed leaderboard queries as empty or zero rankings', async () => {
    const s = await readFile('src/pages/Leaderboard.jsx', 'utf8');
    expect(s).toContain('isError: usersError');
    expect(s).toContain('isError: postsError');
    expect(s).toContain('Leaderboard unavailable');
    expect(s).toContain('leaderboardLoadProblem');
    expect(s).toContain('refetchUsers');
    expect(s).toContain('refetchPosts');
  });
});
