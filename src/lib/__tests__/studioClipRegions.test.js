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
});
