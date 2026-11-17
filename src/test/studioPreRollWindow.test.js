import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { studioPreRollWindow } from '../lib/studioPreRollWindow.js';

describe('Studio pre-roll timeline window', () => {
  it('skips pre-roll at timeline zero', () => {
    expect(studioPreRollWindow(0, 4)).toEqual({ startTime: 0, duration: 0, enabled: false });
  });
  it('limits pre-roll to available earlier timeline', () => {
    expect(studioPreRollWindow(1.25, 4)).toEqual({ startTime: 0, duration: 1.25, enabled: true });
  });
  it('uses the requested length when there is sufficient lead-in', () => {
    expect(studioPreRollWindow(12, 3)).toEqual({ startTime: 9, duration: 3, enabled: true });
  });
  it('rejects negative or invalid positions and requested durations', () => {
    expect(studioPreRollWindow(-5, 3).enabled).toBe(false);
    expect(studioPreRollWindow(NaN, 2).enabled).toBe(false);
    expect(studioPreRollWindow(10, -3).enabled).toBe(false);
  });
  it('connects the window to the pre-roll handoff', async () => {
    const source = await readFile('src/pages/Studio.jsx', 'utf8');
    const part = source.slice(source.indexOf('// Pre-roll: use only'),source.indexOf('// One-shot bypass when pre-roll playback'));
    expect(part).toContain('studioPreRollWindow(currentTimeRef.current, preRoll)');
    expect(part).toContain('preRollWindow.enabled');
    expect(part).toContain('updateCurrentTime(preRollWindow.startTime)');
  });
});
