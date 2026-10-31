import { describe, expect, it } from 'vitest';
import {
  cutClipRegionSide,
  getTrackClipRegions,
  healTrackRegions,
  splitTrackRegion,
} from '../lib/studioClipRegions';

const makeTrack = () => ({
  id: 'track-1',
  startTime: 0,
  duration: 10,
  fullDuration: 10,
  waveform: Array.from({ length: 100 }, (_, index) => index / 100),
  clipRegions: [{
    id: 'region-1',
    timelineStart: 0,
    sourceStart: 0,
    sourceEnd: 10,
  }],
});

describe('NaliStudio clip-region editing', () => {
  it('cuts away the audio before the cut point and keeps the right side on the same track', () => {
    const track = makeTrack();
    const result = cutClipRegionSide(track, 'region-1', 3);
    const [kept] = getTrackClipRegions(result);

    expect(result.id).toBe(track.id);
    expect(result.removed).toBe(true);
    expect(kept).toMatchObject({
      id: 'region-1',
      timelineStart: 3,
      sourceStart: 3,
      sourceEnd: 10,
    });
  });

  it('cuts away the audio after the cut point and keeps the left side on the same track', () => {
    const track = makeTrack();
    const result = cutClipRegionSide(track, 'region-1', 7);
    const [kept] = getTrackClipRegions(result);

    expect(result.id).toBe(track.id);
    expect(result.removed).toBe(true);
    expect(kept).toMatchObject({
      id: 'region-1',
      timelineStart: 0,
      sourceStart: 0,
      sourceEnd: 7,
    });
  });

  it('does not treat an edge click as a successful cut', () => {
    const track = makeTrack();
    const result = cutClipRegionSide(track, 'region-1', 0);

    expect(result.removed).toBe(false);
    expect(getTrackClipRegions(result)).toEqual(track.clipRegions);
  });

  it('splits a region into two editable regions without creating a track', () => {
    const track = makeTrack();
    const result = splitTrackRegion(track, 4, (side) => `region-${side}`);

    expect(result.id).toBe(track.id);
    expect(result.clipRegions).toHaveLength(2);
    expect(result.clipRegions[0]).toMatchObject({
      id: 'region-left',
      timelineStart: 0,
      sourceStart: 0,
      sourceEnd: 4,
    });
    expect(result.clipRegions[1]).toMatchObject({
      id: 'region-right',
      timelineStart: 4,
      sourceStart: 4,
      sourceEnd: 10,
    });
  });

  it('heals adjacent split regions back into one region', () => {
    const split = splitTrackRegion(makeTrack(), 4, (side) => `region-${side}`);
    const result = healTrackRegions(split, 'region-left');

    expect(result.id).toBe('track-1');
    expect(result.healed).toBe(true);
    expect(result.clipRegions).toHaveLength(1);
    expect(result.clipRegions[0]).toMatchObject({
      timelineStart: 0,
      sourceStart: 0,
      sourceEnd: 10,
    });
  });
});
