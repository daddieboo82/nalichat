import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

describe('public marketing metadata', () => {
  it('matches the landing page to NaliChat creator messaging and Studio capabilities', () => {
    const html = fs.readFileSync('index.html', 'utf8');

    expect(html).toContain('<title>NaliChat | Messaging & Music Studio for Creators</title>');
    expect(html).toContain('real-time creator messaging');
    expect(html).toContain('high-resolution audio sharing');
    expect(html).toContain('built-in music Studio');
    expect(html).toContain('AI-assisted music tools');
    expect(html).not.toContain('The ultimate platform for music creators');
  });
});
