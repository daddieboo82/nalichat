import { describe, expect, it } from 'vitest';
import { studioPlaybackPosition } from '../lib/studioPlaybackPosition.js';

describe('Studio split-clip transport coordinates', () => {
  it('maps adjacent clip records to their own correct source ranges', () => {
    const left = { startTime: 0, duration: 5, clipStart: 2 };
    const right = { startTime: 5, duration: 5, clipStart: 7 };
    expect(studioPlaybackPosition(left, 4.99)).toEqual({ active: true, sourceTime: 6.99 });
    expect(studioPlaybackPosition(left, 5).active).toBe(false);
    expect(studioPlaybackPosition(right, 4.99).active).toBe(false);
    expect(studioPlaybackPosition(right, 5)).toEqual({ active: true, sourceTime: 7 });
    expect(studioPlaybackPosition(right, 8)).toEqual({ active: true, sourceTime: 10 });
  });
  it('never plays before a clip or after its right boundary', () => {
    const clip = { startTime: 10, duration: 2, clipStart: 3 };
    expect(studioPlaybackPosition(clip, 9)).toEqual({ active: false, sourceTime: null });
    expect(studioPlaybackPosition(clip, 12)).toEqual({ active: false, sourceTime: null });
  });
  it('rejects invalid timing and calculates trimmed source offsets', () => {
    expect(studioPlaybackPosition({ startTime: 5, duration: 3, clipStart: 14 }, 6).sourceTime).toBe(15);
    expect(studioPlaybackPosition({ startTime: 0, duration: 0 }, 0).active).toBe(false);
    expect(studioPlaybackPosition({ startTime: NaN, duration: 4 }, 2).active).toBe(false);
    expect(studioPlaybackPosition({ startTime: 0, duration: 3 }, NaN).active).toBe(false);
  });
});
