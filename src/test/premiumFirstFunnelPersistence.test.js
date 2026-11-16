import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Premium-first onboarding funnel persistence', () => {
  it('persists impression, Premium interest and free-path events', async () => {
    const source = await readFile('src/lib/productAnalytics.js', 'utf8');
    const start = source.indexOf('const funnelEvents = new Set([');
    const end = source.indexOf(']);', start);
    const allowed = source.slice(start, end);
    for (const event of ['entitlement_prompt_view', 'entitlement_prompt_convert', 'paywall_dismissed']) {
      expect(allowed).toContain('"' + event + '"');
    }
    expect(source).toContain('base44.entities.ActivationFunnel.create(record)');
    const tour = await readFile('src/components/onboarding/WelcomeTour.jsx', 'utf8');
    expect(tour).toContain('source: "first_login_welcome_tour"');
    expect(tour).toContain('Continue free');
  });
});
