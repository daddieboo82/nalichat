import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('checkout campaign attribution', () => {
  it('adds non-PII campaign context to checkout-start analytics', () => {
    const pricing = fs.readFileSync('src/components/pricing/PricingPlans.jsx', 'utf8');
    expect(pricing).toContain('const attribution = getMarketingAttribution();');
    expect(pricing).toContain('campaign_source: attribution?.utm_source');
    expect(pricing).toContain('campaign_name: attribution?.utm_campaign');
    expect(pricing).toContain('campaign_term: attribution?.utm_term');
    expect(pricing).toContain('google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid)');
  });
});
