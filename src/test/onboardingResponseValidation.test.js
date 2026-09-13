import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('onboarding response validation', () => {
  it('does not redirect home unless completeOnboarding explicitly confirms success', async () => {
    const s = await readFile('src/pages/Onboarding.jsx', 'utf8');
    expect(s).toContain('if (res?.data?.success !== true) throw new Error("Profile setup was not confirmed");');
  });
});
