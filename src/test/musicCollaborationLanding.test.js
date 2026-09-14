import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('Campaign #2 music collaboration landing page', () => {
  it('has focused ad-message matching, free-start CTA, trust links, and attribution capture', () => {
    const page = fs.readFileSync('src/pages/MusicCollaborationLanding.jsx', 'utf8');
    const app = fs.readFileSync('src/App.jsx', 'utf8');
    const assetPack = fs.readFileSync('docs/GOOGLE_ADS_CAMPAIGN_2.md', 'utf8');

    expect(app).toContain('path="/music-collaboration"');
    expect(page).toContain('Creator Messaging & Music Collaboration in One Workspace');
    expect(page).toContain('Start Free');
    expect(page).toContain('View Plans');
    expect(page).toContain('Core chat is free forever');
    expect(page).toContain('captureMarketingAttribution();');
    expect(page).toContain('attributedPath("/register")');
    expect(page).toContain('attributedPath("/pricing")');
    expect(page).toContain('gclid');
    expect(page).toContain('wbraid');
    expect(page).toContain('Privacy Policy');
    expect(page).toContain('Terms of Service');
    expect(page).toContain('support@nalichat.org');
    expect(page).toContain('Music Collaboration & Creator Messaging | NaliChat');
    expect(page).toContain('meta[name="description"]');
    expect(page).toContain('Real-time creator messaging, audio sharing, music collaboration');
    expect(assetPack).toContain('https://nalichat.org/music-collaboration?utm_source=google');
  });
});
