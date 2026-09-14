import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('pricing campaign attribution', () => {
  it('captures attribution when an ad or sitelink lands directly on pricing', () => {
    const pricing = fs.readFileSync('src/components/pricing/PricingPlans.jsx', 'utf8');
    expect(pricing).toContain('captureMarketingAttribution');
    expect(pricing).toContain('captureMarketingAttribution();');
    expect(pricing).toContain('trackPaywallEvent("paywall_view"');
  });
});
