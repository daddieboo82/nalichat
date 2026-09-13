import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('challenge creation response validation', () => {
  it('does not show success or navigate without a confirmed challenge id', async () => {
    const s = await readFile('src/pages/CreateChallenge.jsx', 'utf8');
    expect(s).toContain('if (!challenge?.id) throw new Error("Challenge creation was not confirmed");');
    const validation = s.indexOf('if (!challenge?.id)');
    const success = s.indexOf('toast.success("Challenge created!")');
    expect(validation).toBeGreaterThan(-1);
    expect(success).toBeGreaterThan(validation);
  });
});
