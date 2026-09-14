import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('signup campaign attribution', () => {
  it('keeps the Google Ads conversion and emits non-PII campaign context for signup analysis', () => {
    const app = fs.readFileSync('src/App.jsx', 'utf8');

    expect(app).toContain("send_to: 'AW-18416125487/twIWCJHa5OkcEK-Mv81E'");
    expect(app).toContain("window.gtag('event', 'sign_up'");
    expect(app).toContain('campaign_source: attribution?.utm_source');
    expect(app).toContain('campaign_term: attribution?.utm_term');
    expect(app).toContain('google_ads_click: Boolean(attribution?.gclid || attribution?.gbraid || attribution?.wbraid)');
    expect(app).not.toContain('campaign_email');
  });
});
