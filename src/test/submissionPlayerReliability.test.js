import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge submission player reliability', () => {
  it('handles failed loads and validates vote responses', async () => {
    const s = await readFile('src/pages/SubmissionPlayer.jsx', 'utf8');
    expect(s).toContain('Submission unavailable');
    expect(s).toContain('setSubmissionLoading(false)');
    expect(s).toContain('setListError(true)');
    expect(s).toContain('if (res?.data?.error) throw new Error(res.data.error);');
    expect(s).toContain('if (!Number.isFinite(nextVoteCount))');
    expect(s).toContain('navigateToLogin();');
  });
});
