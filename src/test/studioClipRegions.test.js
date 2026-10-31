import { describe, expect, it } from 'vitest';
import {
  cutClipRegionSide,
  getTrackClipRegions,
  healTrackRegions,
  moveClipRegion,
  moveTrackClipRegions,
  shuffleMoveClipRegion,
  splitTrackRegion,
  trimClipRegionLeft,
  trimClipRegionRight,
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

  it('expands the lane bounds when a single region is moved outside its old clip', () => {
    const result = moveClipRegion(makeTrack(), 'region-1', 14);

    expect(result.startTime).toBe(14);
    expect(result.duration).toBe(10);
    expect(result.clipRegions[0].timelineStart).toBe(14);
  });

  it('moves all regions together while preserving their gaps and source offsets', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'left', timelineStart: 2, sourceStart: 0, sourceEnd: 3 },
        { id: 'right', timelineStart: 7, sourceStart: 3, sourceEnd: 6 },
      ],
    };
    const result = moveTrackClipRegions(track, 5);

    expect(result.startTime).toBe(7);
    expect(result.duration).toBe(8);
    expect(result.clipRegions.map(region => region.timelineStart)).toEqual([7, 12]);
    expect(result.clipRegions.map(region => [region.sourceStart, region.sourceEnd])).toEqual([[0, 3], [3, 6]]);
  });

  it('preserves the original source duration when a region is first split', () => {
    const track = { ...makeTrack(), fullDuration: undefined };
    const result = splitTrackRegion(track, 4, side => `split-${side}`);

    expect(result.fullDuration).toBe(10);
  });

  it('Shuffle mode pushes overlapping regions right without creating overlaps', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 2 },
        { id: 'b', timelineStart: 3, sourceStart: 2, sourceEnd: 4 },
        { id: 'c', timelineStart: 5, sourceStart: 4, sourceEnd: 6 },
      ],
    };
    const result = shuffleMoveClipRegion(track, 'a', 4);

    expect(result.clipRegions.map(region => [region.id, region.timelineStart])).toEqual([
      ['a', 4],
      ['b', 6],
      ['c', 8],
    ]);
  });

  it('Shuffle Cut ripples later regions while preserving existing silence gaps', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 10 },
        { id: 'b', timelineStart: 12, sourceStart: 0, sourceEnd: 2 },
      ],
    };
    const result = cutClipRegionSide(track, 'a', 7, { shuffle: true });

    expect(result.clipRegions[0]).toMatchObject({
      timelineStart: 0,
      sourceStart: 0,
      sourceEnd: 7,
    });
    expect(result.clipRegions[1].timelineStart).toBe(9);
  });

  it('Shuffle right-trim moves later regions by the same applied duration change', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 4 },
        { id: 'b', timelineStart: 6, sourceStart: 4, sourceEnd: 6 },
      ],
    };
    const result = trimClipRegionRight(track, 'a', 1, { shuffle: true });

    expect(result.clipRegions[0].sourceEnd).toBe(5);
    expect(result.clipRegions[1].timelineStart).toBe(7);
  });

  it('recalculates lane bounds when trimming region edges', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [{ id: 'region-1', timelineStart: 2, sourceStart: 2, sourceEnd: 8 }],
    };
    const leftExtended = trimClipRegionLeft(track, 'region-1', -1);
    expect(leftExtended.startTime).toBe(1);
    expect(leftExtended.duration).toBe(7);

    const rightExtended = trimClipRegionRight(track, 'region-1', 3);
    expect(rightExtended.startTime).toBe(2);
    expect(rightExtended.duration).toBe(9);
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
