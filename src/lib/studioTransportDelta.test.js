import { describe, expect, it } from 'vitest';
import { studioTransportFrameDelta, STUDIO_PLAYBACK_MAX_FRAME_SECONDS } from './studioTransportDelta';

describe('Studio transport timing after browser suspension', () => {
  it('preserves normal playback frame deltas', () => {
    expect(studioTransportFrameDelta(1016, 1000)).toBeCloseTo(0.016);
    expect(studioTransportFrameDelta(1080, 1000)).toBeCloseTo(0.08);
  });

  it('does not skip minutes of playback when requestAnimationFrame resumes', () => {
    expect(studioTransportFrameDelta(61000, 1000)).toBe(STUDIO_PLAYBACK_MAX_FRAME_SECONDS);
    expect(studioTransportFrameDelta(2100, 1000)).toBe(STUDIO_PLAYBACK_MAX_FRAME_SECONDS);
  });

  it('preserves real elapsed recording time for take positioning', () => {
    expect(studioTransportFrameDelta(61000, 1000, { recording: true })).toBe(60);
    expect(studioTransportFrameDelta(1016, 1000, { recording: true })).toBeCloseTo(0.016);
  });

  it('ignores invalid or backwards timestamps', () => {
    expect(studioTransportFrameDelta(NaN, 1000)).toBe(0);
    expect(studioTransportFrameDelta(1000, Infinity)).toBe(0);
    expect(studioTransportFrameDelta(500, 1000)).toBe(0);
    expect(studioTransportFrameDelta(500, 1000, { recording: true })).toBe(0);
  });
});
