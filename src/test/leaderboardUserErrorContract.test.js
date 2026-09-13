import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('leaderboard user query error contract', () => {
  it('throws resolved listPublicUsers errors so the retry UI activates', async () => {
    const s = await readFile('src/pages/Leaderboard.jsx', 'utf8');
    expect(s).toContain('if (res?.data?.error) throw new Error(res.data.error);');
    expect(s).toContain('isError: usersError');
  });
});
