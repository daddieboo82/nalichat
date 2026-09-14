import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('purchase campaign attribution', () => {
  it('adds non-PII campaign context to confirmed subscription outcomes', () => {
    const page = fs.readFileSync('src/pages/ThankYou.jsx', 'utf8');
    expect(page).toContain('const attribution = getMarketingAttribution();');
    expect(page).toContain('"purchase_completed"');
    expect(page).toContain('campaign_source: attribution?.utm_source');
    expect(page).toContain('campaign_name: attribution?.utm_campaign');
    expect(page).toContain('campaign_term: attribution?.utm_term');
    expect(page).toContain('google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid)');
  });
});
