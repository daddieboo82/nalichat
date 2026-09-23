import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('home marketing claims', () => {
  it('uses concrete, supportable creator messaging and pricing language', () => {
    const home = fs.readFileSync('src/pages/Home.jsx', 'utf8');

    expect(home).toContain("THE CREATOR WORKSPACE · PREMIUM POWER WHEN YOU'RE READY");
    expect(home).toContain('Make Music.');
    expect(home).toContain('Connect. Create. Grow.');
    expect(home).toContain('Start Creating Free');
    expect(home).toContain('Start creating free');
    expect(home).toContain('No card · Google or email');
    expect(home).toContain('home_mobile_sticky');
    expect(home).toContain('Start creating, move between NaliBase worlds, and unlock Premium power');
    expect(home).toContain('Creator Messaging & Collaboration');
    expect(home).toContain('Real-time messaging, unlimited voice notes & high-res file sharing');
    expect(home).toContain('Privacy Policy');
    expect(home).toContain('Terms of Service');
    expect(home).toContain('Compare Plans');
    expect(home).toContain('Contact Support');
    expect(home).toContain('mailto:support@nalichat.org');
    expect(home).toContain('to="/pricing"');
    expect(home).toContain('NaliBase · Six connected worlds for creativity, entertainment, collaboration, and discovery');
    expect(home).toContain('Six worlds. One identity. Endless creative movement.');
    expect(home).toContain('Create immediately · Upgrade to Premium for the complete creator toolkit');
    expect(home).not.toContain('The Ultimate Messaging App for Creators');
    expect(home).not.toContain('Join thousands of artists already');
    expect(home).not.toContain('Desktop downloads included');
  });
});
