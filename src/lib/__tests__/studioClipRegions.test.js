import { describe, expect, it } from 'vitest';
import {
  getTrackClipRegions,
  cutClipRegionSide,
  healTrackRegions,
  moveClipRegion,
  slipClipRegion,
  splitTrackRegion,
  trimClipRegionLeft,
  trimClipRegionRight,
} from '@/lib/studioClipRegions';

describe('NaliStudio clip regions', () => {
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

  it('moves a region without changing its source in/out points', () => {
    const track = splitTrackRegion({ id: 3, startTime: 2, duration: 8, clipStart: 5 }, 6, side => side);
    const moved = moveClipRegion(track, 'left', 20);
    expect(moved.clipRegions.find(region => region.id === 'left')).toMatchObject({
      timelineStart: 20, sourceStart: 5, sourceEnd: 9,
    });
  });

  it('slip-edits source audio without moving the region on the timeline', () => {
    const track = { id: 4, clipRegions: [{ id: 'a', timelineStart: 12, sourceStart: 2, sourceEnd: 7 }] };
    const slipped = slipClipRegion(track, 'a', 10, 5);
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

  it('cuts away the left or right side based on which half is clicked', () => {
    const track = { id: 6, clipRegions: [{ id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 10 }] };
    const keepRight = cutClipRegionSide(track, 'a', 3);
    expect(keepRight.clipRegions[0]).toMatchObject({ timelineStart: 3, sourceStart: 3, sourceEnd: 10 });
    const keepLeft = cutClipRegionSide(track, 'a', 7);
    expect(keepLeft.clipRegions[0]).toMatchObject({ timelineStart: 0, sourceStart: 0, sourceEnd: 7 });
  });

});
