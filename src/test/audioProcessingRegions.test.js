import { describe, expect, it } from 'vitest';
import { getAutomationValueAtTime, getClipRegionFadeGainAtTime, getClipRegionGain, getTrackFadeGainAtTime, getTrackRegionFadeGainAtTime, getTrackRegionRenderSchedule } from '../lib/audioProcessing';
import { cutClipRegionSide, slipClipRegion } from '../lib/studioClipRegions';

describe('timeline automation interpolation', () => {
  it('holds the track base value before the first point and ramps into it', () => {
    const points = [{ time: 4, value: 20 }];
    expect(getAutomationValueAtTime(points, 0, 80, 0)).toBe(80);
    expect(getAutomationValueAtTime(points, 2, 80, 0)).toBe(50);
    expect(getAutomationValueAtTime(points, 4, 80, 0)).toBe(20);
  });

  it('interpolates between points and holds the final value afterward', () => {
    const points = [{ time: 2, value: 100 }, { time: 6, value: 20 }];
    expect(getAutomationValueAtTime(points, 4, 75, 0)).toBe(60);
    expect(getAutomationValueAtTime(points, 8, 75, 0)).toBe(20);
  });

  it('uses the base value when no valid automation points exist', () => {
    expect(getAutomationValueAtTime([], 5, 72, 0)).toBe(72);
    expect(getAutomationValueAtTime([{ time: 'bad', value: 20 }], 5, 72, 0)).toBe(72);
  });
});

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

  it('applies independent region fades without changing the track-wide envelope', () => {
    const region = { timelineStart: 12, sourceStart: 0, sourceEnd: 4, fadeIn: 0.5, fadeOut: 0.25 };
    expect(getClipRegionFadeGainAtTime(region, 12)).toBe(0);
    expect(getClipRegionFadeGainAtTime(region, 13)).toBe(0.5);
    expect(getClipRegionFadeGainAtTime(region, 14)).toBe(1);
    expect(getClipRegionFadeGainAtTime(region, 15.5)).toBe(0.5);
    expect(getTrackFadeGainAtTime({ startTime: 0, duration: 20, clipRegions: [region] }, 13)).toBe(0.5);
  });

  it('multiplies track and region fades when both are active', () => {
    const track = {
      startTime: 0, duration: 10, fadeIn: 0.5,
      clipRegions: [{ id: 'region', timelineStart: 2, sourceStart: 0, sourceEnd: 4, fadeIn: 0.5 }],
    };
    expect(getTrackFadeGainAtTime(track, 3)).toBeCloseTo(0.3);
  });

  it('converts independent region gain from decibels to linear amplitude', () => {
    expect(getClipRegionGain({ gainDb: 0 })).toBe(1);
    expect(getClipRegionGain({ gainDb: -6 })).toBeCloseTo(0.501187);
    expect(getClipRegionGain({ gainDb: 6 })).toBeCloseTo(1.995262);
  });

  it('keeps legacy track fades from being applied twice as region fades', () => {
    const legacyTrack = { startTime: 0, duration: 8, fadeIn: 0.25 };
    expect(getTrackFadeGainAtTime(legacyTrack, 1)).toBe(0.5);
  });

  it('evaluates region fade-out at the exact offline region endpoint', () => {
    const track = { startTime: 0, duration: 4 };
    const region = { timelineStart: 0, sourceStart: 0, sourceEnd: 4, fadeOut: 0.25 };
    expect(getTrackRegionFadeGainAtTime(track, region, 3.5)).toBe(0.5);
    expect(getTrackRegionFadeGainAtTime(track, region, 4)).toBe(0);
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
      { timelineStart: 0, sourceStart: 0, duration: 2, fadeIn: 0, fadeOut: 0, gainDb: 0 },
      { timelineStart: 5, sourceStart: 4, duration: 3, fadeIn: 0, fadeOut: 0, gainDb: 0 },
    ]);
  });

  it('preserves independent region fade settings in the render schedule', () => {
    const track = {
      clipRegions: [{ id: 'faded', timelineStart: 2, sourceStart: 1, sourceEnd: 5, fadeIn: 0.25, fadeOut: 0.5 }],
    };
    expect(getTrackRegionRenderSchedule(track, 8)).toEqual([
      { timelineStart: 2, sourceStart: 1, duration: 4, fadeIn: 0.25, fadeOut: 0.5, gainDb: 0 },
    ]);
  });

  it('preserves independent region gain in the offline render schedule', () => {
    const track = {
      clipRegions: [{ id: 'quiet', timelineStart: 1, sourceStart: 0, sourceEnd: 2, gainDb: -9 }],
    };
    expect(getTrackRegionRenderSchedule(track, 4)).toEqual([
      { timelineStart: 1, sourceStart: 0, duration: 2, fadeIn: 0, fadeOut: 0, gainDb: -9 },
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
      { timelineStart: 3, sourceStart: 4, duration: 2, fadeIn: 0, fadeOut: 0, gainDb: 0 },
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
      { timelineStart: 0, sourceStart: 0, duration: 3, fadeIn: 0, fadeOut: 0, gainDb: 0 },
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
      { timelineStart: 4, sourceStart: 3, duration: 3, fadeIn: 0, fadeOut: 0, gainDb: 0 },
    ]);
  });

  it('supports legacy unsplit tracks using their start and clip offsets', () => {
    const track = { startTime: 3, duration: 2, clipStart: 4 };

    expect(getTrackRegionRenderSchedule(track, 10)).toEqual([
      { timelineStart: 3, sourceStart: 4, duration: 2, fadeIn: 0, fadeOut: 0, gainDb: 0 },
    ]);
  });
});
