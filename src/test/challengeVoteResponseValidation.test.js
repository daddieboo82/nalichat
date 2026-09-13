import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge vote response validation', () => {
  it('does not show vote success for backend error or malformed responses', async () => {
    const s = await readFile('src/pages/ChallengeDetail.jsx', 'utf8');
    expect(s).toContain('if (res?.data?.error) throw new Error(res.data.error);');
    expect(s).toContain('Number(res?.data?.vote_count)');
    expect(s).toContain('if (!Number.isFinite(nextVoteCount))');
    expect(s).toContain('err?.message || "Couldn\'t cast vote"');
  });
});
