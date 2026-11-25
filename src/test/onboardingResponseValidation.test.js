import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('onboarding response validation', () => {
  it('does not redirect home unless completeOnboarding explicitly confirms success', async () => {
    const s = await readFile('src/pages/Onboarding.jsx', 'utf8');
    expect(s).toContain('res?.data?.action !== "complete_onboarding"');
    expect(s).toContain('res?.data?.userId !== submittingUserId');
    expect(s).toContain('res?.data?.onboardingCompleted !== true');
  });

  it('handles a repeated completed-account request before rate limits or profile writes', async () => {
    const source = await readFile('base44/functions/completeOnboarding/entry.ts', 'utf8');
    const alreadyCompleted = source.indexOf('if (user.onboarding_completed === true)');
    const rateLimit = source.indexOf('const writeRate = await consumeHourlyLimit(');
    const profileWrite = source.indexOf('await base44.asServiceRole.entities.User.update(user.id, patch)');
    expect(alreadyCompleted).toBeGreaterThan(0);
    expect(alreadyCompleted).toBeLessThan(rateLimit);
    expect(alreadyCompleted).toBeLessThan(profileWrite);
    const replay = source.slice(alreadyCompleted, rateLimit);
    expect(replay).toContain("action: 'complete_onboarding'");
    expect(replay).toContain('userId: user.id');
    expect(replay).toContain('onboardingCompleted: true');
  });

  it('binds completion confirmation to the authenticated user', async () => {
    const s = await readFile('base44/functions/completeOnboarding/entry.ts', 'utf8');
    expect(s).toContain("action: 'complete_onboarding'");
    expect(s).toContain('userId: user.id');
    expect(s).toContain('onboardingCompleted: true');
  });
});
