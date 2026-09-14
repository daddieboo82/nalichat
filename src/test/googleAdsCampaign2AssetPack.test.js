import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Google Ads Campaign #2 asset pack', () => {
  it('keeps RSA headlines and descriptions within Google Ads character limits', () => {
    const md = fs.readFileSync('docs/GOOGLE_ADS_CAMPAIGN_2.md', 'utf8');
    const headlineBlock = md.split('## Responsive Search Ad headlines')[1].split('## Responsive Search Ad descriptions')[0];
    const descriptionBlock = md.split('## Responsive Search Ad descriptions')[1].split('## Suggested sitelinks')[0];

    const headlines = [...headlineBlock.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1].trim());
    const descriptions = [...descriptionBlock.matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1].trim());

    expect(headlines).toHaveLength(15);
    expect(descriptions).toHaveLength(4);
    for (const headline of headlines) expect(headline.length).toBeLessThanOrEqual(30);
    for (const description of descriptions) expect(description.length).toBeLessThanOrEqual(90);
  });

  it('provides at least six relevant sitelinks and avoids the coming-soon Downloads page', () => {
    const md = fs.readFileSync('docs/GOOGLE_ADS_CAMPAIGN_2.md', 'utf8');
    const sitelinkRows = md.split('\n').filter((line) => line.startsWith('| ') && line.includes('https://nalichat.org/'));
    expect(sitelinkRows.length).toBeGreaterThanOrEqual(6);
    expect(md).not.toContain('https://nalichat.org/download |');
    expect(md).toContain('utm_source=google&utm_medium=cpc&utm_campaign=google_ads_campaign_2');
    expect(md).toContain('auto-tagging');
  });
});
