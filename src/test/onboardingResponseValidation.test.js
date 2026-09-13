import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('onboarding response validation', () => {
  it('does not redirect home unless completeOnboarding explicitly confirms success', async () => {
    const s = await readFile('src/pages/Onboarding.jsx', 'utf8');
    expect(s).toContain('res?.data?.action !== "complete_onboarding"');
    expect(s).toContain('res?.data?.userId !== submittingUserId');
    expect(s).toContain('res?.data?.onboardingCompleted !== true');
    it('binds completion confirmation to the authenticated user', async () => {
    const s = await readFile('base44/functions/completeOnboarding/entry.ts', 'utf8');
    expect(s).toContain("action: 'complete_onboarding'");
    expect(s).toContain('userId: user.id');
    expect(s).toContain('onboardingCompleted: true');
  });
});
});
