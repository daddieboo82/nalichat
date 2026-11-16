import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
describe('public marketing metadata', () => {
  it('matches the landing page to the NaliBase universe', () => {
    const html = fs.readFileSync('index.html', 'utf8');
    expect(html).toContain('<title>NaliChat by NaliBase | Music Studio, Messaging & Creator Community</title>');
    expect(html).toContain('A creator community with messaging, music Studio and collaborative tools. Start free.');
    expect(html).toContain('Explore six connected worlds for creativity, entertainment, collaboration, discovery, visual storytelling, and competition.');
    expect(html).not.toContain('<title>NaliChat | Messaging & Music Studio for Creators</title>');
    expect(html).toContain('<link rel="canonical" href="https://nalichat.org/" />');
    expect(html).toContain('"@type":"SoftwareApplication"');
  });
});