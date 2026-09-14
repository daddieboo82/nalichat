/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest';
import { captureMarketingAttribution, getMarketingAttribution } from '@/lib/adAttribution';

describe('marketing attribution capture', () => {
  beforeEach(() => sessionStorage.clear());

  it('preserves Google Ads click IDs and UTM campaign context for the signup journey', () => {
    const record = captureMarketingAttribution('?gclid=test-click&utm_source=google&utm_medium=cpc&utm_campaign=campaign-2&utm_term=music+collaboration');

    expect(record.gclid).toBe('test-click');
    expect(record.utm_source).toBe('google');
    expect(record.utm_medium).toBe('cpc');
    expect(record.utm_campaign).toBe('campaign-2');
    expect(record.utm_term).toBe('music+collaboration');
    expect(getMarketingAttribution().gclid).toBe('test-click');
  });

  it('does not overwrite attribution when the visit has no marketing parameters', () => {
    captureMarketingAttribution('?gclid=original&utm_source=google');
    captureMarketingAttribution('');
    expect(getMarketingAttribution().gclid).toBe('original');
  });
});
