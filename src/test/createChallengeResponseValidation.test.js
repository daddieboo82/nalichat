import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge creation response validation', () => {
  it('does not show success or navigate without a confirmed challenge id', async () => {
    const s = await readFile('src/pages/CreateChallenge.jsx', 'utf8');
    expect(s).toContain('res?.data?.action !== "create_challenge"');
    expect(s).toContain('res?.data?.userId !== user.id');
    expect(s).toContain('challenge.host_artist_id !== user.id');
    const validation = s.indexOf('if (!challenge?.id)');
    const success = s.indexOf('toast.success("Challenge created!")');
    expect(validation).toBeGreaterThan(-1);
    expect(success).toBeGreaterThan(validation);
  });
});
