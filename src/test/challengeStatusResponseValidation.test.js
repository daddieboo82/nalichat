import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge status response validation', () => {
  it('requires the server to confirm the requested status before showing success', async () => {
    const s = await readFile('src/pages/ChallengeDetail.jsx', 'utf8');
    expect(s).toContain('const updatedChallenge = res?.data?.challenge;');
    expect(s).toContain('updatedChallenge.status !== newStatus');
    expect(s).toContain('Challenge status update was not confirmed');
    expect(s).not.toContain('res?.data?.challenge || ((c) => ({ ...c, status: newStatus }))');
  });
});
