import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Premium-first, free-available first login tour', () => {
  it('presents Premium before other tour steps with a clear free choice', async () => {
    const source = await readFile('src/components/onboarding/WelcomeTour.jsx', 'utf8');
    const premium = source.indexOf('title: "Create free. Unlock more with Premium."');
    const welcome = source.indexOf('title: "Welcome to NaliBase!"');
    expect(premium).toBeGreaterThan(0);
    expect(premium).toBeLessThan(welcome);
    expect(source).toContain('secondary: { label: "Continue free", action: "next" }');
    expect(source).toContain('primary: { label: "Explore Premium plans", action: "navigate", path: "/pricing" }');
    expect(source).toContain('$7.99/month');
  });
  it('tracks offer exposure and choices and preserves existing tour completion', async () => {
    const source = await readFile('src/components/onboarding/WelcomeTour.jsx', 'utf8');
    expect(source).toContain('entitlement_prompt_view');
    expect(source).toContain('entitlement_prompt_convert');
    expect(source).toContain('paywall_dismissed');
    expect(source).toContain('first_login_welcome_tour');
    expect(source).toContain('welcome_tour_completed: true');
    expect(source).toContain('if (!await complete()) return;');
  });
});
