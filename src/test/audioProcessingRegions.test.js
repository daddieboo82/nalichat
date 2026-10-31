import { describe, expect, it } from 'vitest';
import { getTrackFadeGainAtTime, getTrackRegionRenderSchedule } from '../lib/audioProcessing';
import { cutClipRegionSide, slipClipRegion } from '../lib/studioClipRegions';

describe('track fade envelope', () => {
  const track = { startTime: 10, duration: 8, fadeIn: 0.25, fadeOut: 0.25 };

  it('ramps from silence to unity across the configured fade-in', () => {
    expect(getTrackFadeGainAtTime(track, 10)).toBe(0);
    expect(getTrackFadeGainAtTime(track, 11)).toBe(0.5);
    expect(getTrackFadeGainAtTime(track, 12)).toBe(1);
  });

  it('ramps from unity to silence across the configured fade-out', () => {
    expect(getTrackFadeGainAtTime(track, 16)).toBe(1);
    expect(getTrackFadeGainAtTime(track, 17)).toBe(0.5);
    expect(getTrackFadeGainAtTime(track, 18)).toBe(0);
  });

  it('keeps the envelope at unity when no fade is configured', () => {
    expect(getTrackFadeGainAtTime({ startTime: 4, duration: 6 }, 4)).toBe(1);
    expect(getTrackFadeGainAtTime({ startTime: 4, duration: 6 }, 10)).toBe(1);
  });
});

describe('offline audio region scheduling', () => {
  it('renders only the surviving source ranges at their timeline positions', () => {
    const track = {
      startTime: 0,
      duration: 8,
      clipRegions: [
        { id: 'left', timelineStart: 0, sourceStart: 0, sourceEnd: 2 },
        { id: 'right', timelineStart: 5, sourceStart: 4, sourceEnd: 7 },
      ],
    };

    expect(getTrackRegionRenderSchedule(track, 8)).toEqual([
      { timelineStart: 0, sourceStart: 0, duration: 2 },
      { timelineStart: 5, sourceStart: 4, duration: 3 },
    ]);
  });

  it('clamps a region to the available source buffer duration', () => {
    const track = {
      startTime: 0,
      duration: 10,
      clipRegions: [
        { id: 'tail', timelineStart: 3, sourceStart: 4, sourceEnd: 10 },
      ],
    };

    expect(getTrackRegionRenderSchedule(track, 6)).toEqual([
      { timelineStart: 3, sourceStart: 4, duration: 2 },
    ]);
  });

  it('drops regions whose source offsets fall beyond the source buffer', () => {
    const track = {
      clipRegions: [
        { id: 'out-of-range', timelineStart: 0, sourceStart: 9, sourceEnd: 12 },
      ],
    };

    expect(getTrackRegionRenderSchedule(track, 8)).toEqual([]);
  });

  it('exports only the retained side after a directional Cut', () => {
    const track = {
      duration: 10,
      fullDuration: 10,
      clipRegions: [{ id: 'clip', timelineStart: 0, sourceStart: 0, sourceEnd: 10 }],
    };
    const cut = cutClipRegionSide(track, 'clip', 3, { direction: 'right' });

    expect(getTrackRegionRenderSchedule(cut, 10)).toEqual([
      { timelineStart: 0, sourceStart: 0, duration: 3 },
    ]);
  });

  it('exports the slipped source range at the region’s unchanged timeline position', () => {
    const track = {
      duration: 10,
      fullDuration: 10,
      clipRegions: [{ id: 'clip', timelineStart: 4, sourceStart: 1, sourceEnd: 4 }],
    };
    const slipped = slipClipRegion(track, 'clip', 2);

    expect(getTrackRegionRenderSchedule(slipped, 10)).toEqual([
      { timelineStart: 4, sourceStart: 3, duration: 3 },
    ]);
  });

  it('supports legacy unsplit tracks using their start and clip offsets', () => {
    const track = { startTime: 3, duration: 2, clipStart: 4 };

    expect(getTrackRegionRenderSchedule(track, 10)).toEqual([
      { timelineStart: 3, sourceStart: 4, duration: 2 },
    ]);
  });
});
