import { describe, expect, it } from 'vitest';
import { studioProjectEndSeconds, nextStudioTransportPosition } from './studioTransportBoundary';

describe('Studio long-session transport boundary', () => {
  it('preserves legacy short-session looping without shortening projects that exceed 100 seconds', () => {
    expect(studioProjectEndSeconds([{ startTime: 0, duration: 35 }])).toBe(100);
    expect(nextStudioTransportPosition({ nextTime: 100.1, tracks: [{ startTime: 0, duration: 35 }] }))
      .toEqual({ time: 0, wrapped: true });
    expect(studioProjectEndSeconds([{ startTime: 35, duration: 190 }])).toBe(225);
    expect(nextStudioTransportPosition({ nextTime: 101, tracks: [{ startTime: 35, duration: 190 }] }))
      .toEqual({ time: 101, wrapped: false });
    expect(nextStudioTransportPosition({ nextTime: 225.1, tracks: [{ startTime: 35, duration: 190 }] }))
      .toEqual({ time: 0, wrapped: true });
  });

  it('never wraps an active recording at the old 100-second cutoff or project end', () => {
    expect(nextStudioTransportPosition({ nextTime: 101, recording: true }))
      .toEqual({ time: 101, wrapped: false });
    expect(nextStudioTransportPosition({ nextTime: 820, recording: true, tracks: [{ startTime: 0, duration: 60 }] }))
      .toEqual({ time: 820, wrapped: false });
  });

  it('preserves explicitly selected loop regions', () => {
    expect(nextStudioTransportPosition({ nextTime: 13, looping: true, selectionStart: 5, selectionEnd: 12 }))
      .toEqual({ time: 5, wrapped: true });
    expect(nextStudioTransportPosition({ nextTime: 9, looping: true, selectionStart: 5, selectionEnd: 12 }))
      .toEqual({ time: 9, wrapped: false });
  });

  it('ignores invalid clip timing rather than using corrupted durations', () => {
    expect(studioProjectEndSeconds([{ startTime: -1, duration: 500 }, { startTime: 10, duration: NaN }, { startTime: 0, duration: 150 }])).toBe(150);
    expect(nextStudioTransportPosition({ nextTime: 101, looping: true, selectionStart: 20, selectionEnd: 10, tracks: [{ duration: 250 }] }))
      .toEqual({ time: 101, wrapped: false });
  });
});
