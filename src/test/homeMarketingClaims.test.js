import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('home marketing claims', () => {
  it('uses concrete, supportable creator messaging and pricing language', () => {
    const home = fs.readFileSync('src/pages/Home.jsx', 'utf8');

    expect(home).toContain('Messaging + Music Studio for Creators');
    expect(home).toContain('Start with free core chat');
    expect(home.match(/Start Free/g)?.length).toBeGreaterThanOrEqual(2);
    expect(home).toContain('Free core chat · Real-time creator messaging');
    expect(home).toContain('Creator Messaging, Music Studio & AI Tools');
    expect(home).toContain('real-time creator messaging, secure audio and file sharing');
    expect(home).toContain('Real-time direct & group messaging');
    expect(home).toContain('Voice notes & audio sharing');
    expect(home).toContain('Privacy Policy');
    expect(home).toContain('Terms of Service');
    expect(home).toContain('View Plans');
    expect(home).toContain('to="/pricing"');
    expect(home).toContain('NaliChat · Creator messaging, music collaboration, and Studio tools');
    expect(home).toContain('Core chat is free forever · No paid plan required to start');
    expect(home).not.toContain('The Ultimate Messaging App for Creators');
    expect(home).not.toContain('Join thousands of artists already');
    expect(home).not.toContain('Desktop downloads included');
  });
});
