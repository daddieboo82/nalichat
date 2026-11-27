import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { studioPlaybackPosition } from '../lib/studioPlaybackPosition.js';

describe('Studio loop boundary sync', () => {
  it('seeks active audio at transport wrap instead of leaving elements at their old positions', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const raf = source.slice(source.indexOf('const updateTime = (time) => {'), source.indexOf('// Latch keeps the last touched value'));
    expect(raf).toContain('nextStudioTransportPosition({');
    expect(raf).toContain('const didWrap = nextPosition.wrapped;');
    expect(raf).toContain('if (didWrap) {');
    expect(raf).toContain('studioPlaybackPosition(track, newTime)');
    expect(raf).toContain('audio.currentTime = position.sourceTime');
    expect(raf).toContain('else if (!audio.paused) audio.pause()');
    expect(raf).toContain('playbackFailedRef.current.clear()');
  });
  it('selection loop restarts in the correct source region of a split clip', () => {
    const left = { startTime: 4, duration: 2, clipStart: 1 };
    const right = { startTime: 6, duration: 4, clipStart: 3 };
    expect(studioPlaybackPosition(left, 7).active).toBe(false);
    expect(studioPlaybackPosition(right, 7).sourceTime).toBe(4);
    expect(studioPlaybackPosition(left, 5).sourceTime).toBe(2);
    expect(studioPlaybackPosition(right, 5).active).toBe(false);
  });
});
