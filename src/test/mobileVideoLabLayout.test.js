import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Music Video Lab responsive layout', () => {
  it('puts the preview first on mobile and keeps media and inspector accessible', async () => {
    const source = await readFile('src/pages/MusicVideoGenerator.jsx', 'utf8');
    expect(source).toContain('id="video-lab-preview" tabIndex={-1} className="order-1');
    expect(source).toContain('id="video-lab-media" tabIndex={-1} className="order-2');
    expect(source).toContain('id="video-lab-inspector" tabIndex={-1} className="order-3');
    expect(source).toContain('lg:order-1');
    expect(source).toContain('lg:order-2');
  });
  it('allows horizontal timeline navigation and mobile playhead adjustments', async () => {
    const source = await readFile('src/pages/MusicVideoGenerator.jsx', 'utf8');
    expect(source).toContain('touch-pan-x overflow-x-auto overscroll-x-contain');
    expect(source).toContain('aria-label="Playhead"');
    expect(source).toContain('Swipe sideways to explore the timeline on a phone.');
  });
});