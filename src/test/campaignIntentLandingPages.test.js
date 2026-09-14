import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Campaign #2 intent-specific landing pages', () => {
  it('routes creator messaging and music studio ad groups to matching pages', () => {
    const app = fs.readFileSync('src/App.jsx', 'utf8');
    const creator = fs.readFileSync('src/pages/CreatorMessagingLanding.jsx', 'utf8');
    const studio = fs.readFileSync('src/pages/MusicStudioLanding.jsx', 'utf8');
    const assetPack = fs.readFileSync('docs/GOOGLE_ADS_CAMPAIGN_2.md', 'utf8');

    expect(app).toContain('path="/creator-messaging"');
    expect(app).toContain('path="/music-studio"');
    expect(creator).toContain('Real-Time Creator Messaging for Artists & Music Teams');
    expect(studio).toContain('Music Studio & AI-Assisted Tools for Creators');
    expect(creator).toContain('captureMarketingAttribution();');
    expect(studio).toContain('captureMarketingAttribution();');
    expect(assetPack).toContain('https://nalichat.org/creator-messaging?utm_source=google');
    expect(assetPack).toContain('https://nalichat.org/music-studio?utm_source=google');
  });
});
