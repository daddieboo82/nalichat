import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('onboarding opt-in Nali help', () => {
  it('does not automatically open the AI assistant over profile setup', async () => {
    const guide = await readFile('src/components/onboarding/OnboardingNaliGuide.jsx', 'utf8');
    expect(guide).toContain('onClick={openHelp}');
    expect(guide).toContain('Need help? Ask Nali');
    expect(guide).toContain('hasEntitlement("ai.standard")');
    expect(guide).not.toContain('useEffect');
    expect(guide).toContain('new CustomEvent("open-ai-assistant"');
  });
  it('keeps the guide inside the setup card and preserves one-step setup', async () => {
    const onboarding = await readFile('src/pages/Onboarding.jsx', 'utf8');
    expect(onboarding).toContain('<OnboardingNaliGuide />');
    expect(onboarding).toContain('Enter NaliBase');
    expect(onboarding).toContain('completeOnboarding');
  });
});