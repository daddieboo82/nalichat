import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('landscape phone navigation', () => {
  it('preserves readable tab labels and full touch targets in short landscape viewports', async () => {
    const css = await readFile('src/index.css', 'utf8');
    expect(css).toContain('(max-width: 1023px) and (max-height: 500px) and (orientation: landscape)');
    expect(css).toContain('nav.nali-nav-chrome[aria-label="Mobile primary navigation"] button {');
    expect(css).toContain('min-height: 3rem;');
    expect(css).toContain('nav.nali-nav-chrome[aria-label="Mobile primary navigation"] button > span {');
    expect(css).toContain('font-size: 11px;');
    expect(css).toContain('header.nali-nav-chrome > div { height: 3rem; }');
  });
});