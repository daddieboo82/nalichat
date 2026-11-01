import { describe, expect, it } from 'vitest';
import {
  getTrackClipRegions,
  getHealCandidateRegionIds,
  findClipRegionPeakTime,
  getClipRegionPeakTimes,
  remapClipRegionSources,
  repeatTrackClipRegions,
  cutClipRegionSide,
  cutTrackTimelineRange,
  healTrackRegions,
  moveClipRegion,
  moveTrackClipRegions,
  slipClipRegion,
  splitTrackRegion,
  trimClipRegionLeft,
  trimClipRegionRight,
} from '@/lib/studioClipRegions';

describe('NaliStudio clip regions', () => {
  it('remaps pitch and stretch source offsets without moving timeline regions', () => {
    const regions = [{ id: 'a', timelineStart: 5, sourceStart: 2, sourceEnd: 6 }];
    expect(remapClipRegionSources(regions, 5, 'pitch', 0.5)[0]).toMatchObject({
      timelineStart: 5, sourceStart: 1, sourceEnd: 3,
    });
  });

  it('reverses source ranges and swaps region fade directions', () => {
    const regions = [{ id: 'a', timelineStart: 5, sourceStart: 2, sourceEnd: 6, fadeIn: 0.25, fadeOut: 0.75 }];
    expect(remapClipRegionSources(regions, 10, 'reverse')[0]).toMatchObject({
      timelineStart: 5, sourceStart: 4, sourceEnd: 8, fadeIn: 0.75, fadeOut: 0.25,
    });
  });

  it('navigates waveform peaks only when they fall inside audible regions', () => {
    const waveform = new Array(1000).fill(0);
    waveform[200] = 0.9;
    waveform[500] = 1;
    waveform[800] = 0.8;
    const track = {
      fullDuration: 10,
      clipRegions: [
        { id: 'first', timelineStart: 0, sourceStart: 0, sourceEnd: 4 },
        { id: 'last', timelineStart: 10, sourceStart: 6, sourceEnd: 10 },
      ],
    };
    expect(findClipRegionPeakTime(track, waveform, 3, 'next')).toBeCloseTo(12);
    expect(findClipRegionPeakTime(track, waveform, 13, 'previous')).toBeCloseTo(12);
    expect(findClipRegionPeakTime(track, waveform, 1, 'next')).toBeCloseTo(2);
    expect(getClipRegionPeakTimes(track, waveform)).toEqual([2, 12]);
  });

  it('adapts a legacy single-clip track without changing the track count', () => {
    const regions = getTrackClipRegions({ id: 7, startTime: 12, duration: 8, clipStart: 3 });
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({
      timelineStart: 12, sourceStart: 3, sourceEnd: 11,
    });
  });

  it('splits into two independently identified regions on the same track', () => {
    const track = { id: 7, startTime: 10, duration: 8, clipStart: 4 };
    const split = splitTrackRegion(track, 13, side => `region-${side}`);
    expect(split.id).toBe(7);
    expect(split.clipRegions).toHaveLength(2);
    expect(split.clipRegions[0]).toMatchObject({
      id: 'region-left', timelineStart: 10, sourceStart: 4, sourceEnd: 7,
    });
    expect(split.clipRegions[1]).toMatchObject({
      id: 'region-right', timelineStart: 13, sourceStart: 7, sourceEnd: 12,
    });
  });

  it('does not split at or outside a region boundary', () => {
    const track = { id: 2, startTime: 5, duration: 4 };
    expect(splitTrackRegion(track, 5, () => 'x').clipRegions).toHaveLength(1);
    expect(splitTrackRegion(track, 9, () => 'x').clipRegions).toHaveLength(1);
  });

  it('heals contiguous regions back into one region', () => {
    const split = splitTrackRegion(
      { id: 1, startTime: 0, duration: 10 },
      4,
      side => side,
    );
    const healed = healTrackRegions(split, 'left');
    expect(healed.healed).toBe(true);
    expect(healed.clipRegions).toHaveLength(1);
    expect(healed.clipRegions[0]).toMatchObject({ sourceStart: 0, sourceEnd: 10 });
  });

  it('does not heal regions with a timeline gap', () => {
    const track = {
      id: 1,
      clipRegions: [
        { id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 4 },
        { id: 'b', timelineStart: 5, sourceStart: 4, sourceEnd: 10 },
      ],
    };
    expect(healTrackRegions(track, 'a').healed).toBe(false);
  });

  it('moves a region into an available gap without changing its source in/out points', () => {
    const track = {
      id: 3,
      clipRegions: [
        { id: 'left', timelineStart: 0, sourceStart: 0, sourceEnd: 4 },
        { id: 'right', timelineStart: 8, sourceStart: 10, sourceEnd: 14 },
      ],
    };
    const moved = moveClipRegion(track, 'right', 5);
    expect(moved.clipRegions.find(region => region.id === 'right')).toMatchObject({
      timelineStart: 5, sourceStart: 10, sourceEnd: 14,
    });
  });

  it('moves all regions together while preserving their relative gaps', () => {
    const track = {
      id: 15,
      clipRegions: [
        { id: 'a', timelineStart: 2, sourceStart: 0, sourceEnd: 3 },
        { id: 'b', timelineStart: 8, sourceStart: 10, sourceEnd: 12 },
      ],
    };
    const moved = moveTrackClipRegions(track, 4);
    expect(moved.id).toBe(15);
    expect(moved.clipRegions.map(region => [region.timelineStart, region.sourceStart])).toEqual([
      [6, 0],
      [12, 10],
    ]);
  });

  it('moves non-audio lanes without creating fake clip regions', () => {
    const moved = moveTrackClipRegions({ id: 16, type: 'midi', startTime: 5 }, 2);
    expect(moved).toMatchObject({ id: 16, type: 'midi', startTime: 7 });
    expect(moved.clipRegions).toBeUndefined();
  });

  it('slip-edits source audio without moving the region on the timeline', () => {
    const track = {
      id: 4,
      fullDuration: 20,
      clipRegions: [{ id: 'a', timelineStart: 12, sourceStart: 2, sourceEnd: 7 }],
    };
    const slipped = slipClipRegion(track, 'a', 8);
    expect(slipped.clipRegions[0]).toMatchObject({
      timelineStart: 12, sourceStart: 10, sourceEnd: 15,
    });
  });

  it('trims the left edge by moving timeline and source starts together', () => {
    const track = { id: 5, clipRegions: [{ id: 'a', timelineStart: 10, sourceStart: 3, sourceEnd: 9 }] };
    const trimmed = trimClipRegionLeft(track, 'a', 2);
    expect(trimmed.clipRegions[0]).toMatchObject({
      timelineStart: 12, sourceStart: 5, sourceEnd: 9,
    });
  });

  it('trims the right edge without changing the region start', () => {
    const track = { id: 5, clipRegions: [{ id: 'a', timelineStart: 10, sourceStart: 3, sourceEnd: 9 }] };
    const trimmed = trimClipRegionRight(track, 'a', -2);
    expect(trimmed.clipRegions[0]).toMatchObject({
      timelineStart: 10, sourceStart: 3, sourceEnd: 7,
    });
  });

  it('trims the first region without changing later split regions', () => {
    const track = {
      id: 12,
      fullDuration: 30,
      clipRegions: [
        { id: 'first', timelineStart: 2, sourceStart: 2, sourceEnd: 8 },
        { id: 'second', timelineStart: 12, sourceStart: 14, sourceEnd: 18 },
      ],
    };
    const trimmed = trimClipRegionLeft(track, 'first', 1.5);
    expect(trimmed.id).toBe(12);
    expect(trimmed.clipRegions).toEqual([
      expect.objectContaining({ id: 'first', timelineStart: 3.5, sourceStart: 3.5, sourceEnd: 8 }),
      expect.objectContaining({ id: 'second', timelineStart: 12, sourceStart: 14, sourceEnd: 18 }),
    ]);
  });

  it('ripples later regions by the right-edge trim delta in Shuffle mode', () => {
    const track = {
      id: 13,
      fullDuration: 30,
      clipRegions: [
        { id: 'first', timelineStart: 0, sourceStart: 0, sourceEnd: 5 },
        { id: 'second', timelineStart: 8, sourceStart: 10, sourceEnd: 14 },
      ],
    };
    const trimmed = trimClipRegionRight(track, 'first', 2, { shuffle: true });
    expect(trimmed.clipRegions).toEqual([
      expect.objectContaining({ id: 'first', timelineStart: 0, sourceStart: 0, sourceEnd: 7 }),
      expect.objectContaining({ id: 'second', timelineStart: 10, sourceStart: 10, sourceEnd: 14 }),
    ]);
  });

  it('repeats a split arrangement on the same track and preserves its gaps', () => {
    const track = {
      id: 14,
      clipRegions: [
        { id: 'a', timelineStart: 2, sourceStart: 0, sourceEnd: 3 },
        { id: 'b', timelineStart: 7, sourceStart: 8, sourceEnd: 10 },
      ],
    };
    const repeated = repeatTrackClipRegions(
      track,
      1,
      (region, pass) => `${region.id}-repeat-${pass}`,
    );
    expect(repeated.id).toBe(14);
    expect(repeated.clipRegions.map(region => [
      region.id, region.timelineStart, region.sourceStart, region.sourceEnd,
    ])).toEqual([
      ['a', 2, 0, 3],
      ['b', 7, 8, 10],
      ['a-repeat-1', 9, 0, 3],
      ['b-repeat-1', 14, 8, 10],
    ]);
  });

  it('chooses the nearest same-track split boundary for Heal', () => {
    const regions = [
      { id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 4 },
      { id: 'b', timelineStart: 4, sourceStart: 4, sourceEnd: 7 },
      { id: 'c', timelineStart: 7, sourceStart: 7, sourceEnd: 10 },
    ];
    expect(getHealCandidateRegionIds(regions, 'b', 6.8)).toEqual(['b', 'a']);
  });

  it('removes the right side at the cut point and keeps the left on the same track', () => {
    const track = { id: 6, clipRegions: [{ id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 10 }] };
    const result = cutClipRegionSide(track, 'a', 3, { direction: 'right' });
    expect(result.id).toBe(6);
    expect(result.removed).toBe(true);
    expect(result.clipRegions).toHaveLength(1);
    expect(result.clipRegions[0]).toMatchObject({
      timelineStart: 0, sourceStart: 0, sourceEnd: 3,
    });
  });

  it('removes the left side at the cut point and keeps the right on the same track', () => {
    const track = { id: 6, clipRegions: [{ id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 10 }] };
    const result = cutClipRegionSide(track, 'a', 7, { direction: 'left' });
    expect(result.id).toBe(6);
    expect(result.removed).toBe(true);
    expect(result.clipRegions).toHaveLength(1);
    expect(result.clipRegions[0]).toMatchObject({
      timelineStart: 7, sourceStart: 7, sourceEnd: 10,
    });
  });

  it('removes only the selected In/Out range and leaves both sides on the same track', () => {
    const track = { id: 8, clipRegions: [{ id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 10 }] };
    const result = cutTrackTimelineRange(track, 3, 7, {
      createId: (side, region) => `${region.id}-${side}`,
    });
    expect(result.id).toBe(8);
    expect(result.removed).toBe(true);
    expect(result.clipRegions).toHaveLength(2);
    expect(result.clipRegions[0]).toMatchObject({
      id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 3,
    });
    expect(result.clipRegions[1]).toMatchObject({
      id: 'a-right', timelineStart: 7, sourceStart: 7, sourceEnd: 10,
    });
  });

  it('ripples later regions left in Shuffle mode without creating a track', () => {
    const track = {
      id: 9,
      clipRegions: [
        { id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 10 },
        { id: 'b', timelineStart: 12, sourceStart: 20, sourceEnd: 24 },
      ],
    };
    const result = cutTrackTimelineRange(track, 3, 7, {
      shuffle: true,
      createId: (side, region) => `${region.id}-${side}`,
    });
    expect(result.id).toBe(9);
    expect(result.clipRegions).toHaveLength(3);
    expect(result.clipRegions.find(region => region.id === 'a-right')).toMatchObject({
      timelineStart: 3, sourceStart: 7, sourceEnd: 10,
    });
    expect(result.clipRegions.find(region => region.id === 'b')).toMatchObject({
      timelineStart: 8, sourceStart: 20, sourceEnd: 24,
    });
  });

  it('cuts across multiple regions while preserving track identity and Slip gaps', () => {
    const track = {
      id: 10,
      clipRegions: [
        { id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 5 },
        { id: 'b', timelineStart: 8, sourceStart: 10, sourceEnd: 15 },
        { id: 'c', timelineStart: 20, sourceStart: 20, sourceEnd: 25 },
      ],
    };
    const result = cutTrackTimelineRange(track, 3, 11, {
      createId: (side, region) => `${region.id}-${side}`,
    });
    expect(result.id).toBe(10);
    expect(result.removed).toBe(true);
    expect(result.clipRegions.map(region => [region.id, region.timelineStart, region.sourceStart, region.sourceEnd])).toEqual([
      ['a', 0, 0, 3],
      ['b-right', 11, 13, 15],
      ['c', 20, 20, 25],
    ]);
  });

  it('shuffles a multi-region cut by the full timeline selection duration', () => {
    const track = {
      id: 11,
      clipRegions: [
        { id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 5 },
        { id: 'b', timelineStart: 8, sourceStart: 10, sourceEnd: 15 },
        { id: 'c', timelineStart: 20, sourceStart: 20, sourceEnd: 25 },
      ],
    };
    const result = cutTrackTimelineRange(track, 3, 11, {
      shuffle: true,
      createId: (side, region) => `${region.id}-${side}`,
    });
    expect(result.id).toBe(11);
    expect(result.clipRegions.map(region => [region.id, region.timelineStart, region.sourceStart, region.sourceEnd])).toEqual([
      ['a', 0, 0, 3],
      ['b-right', 3, 13, 15],
      ['c', 12, 20, 25],
    ]);
  });

});
