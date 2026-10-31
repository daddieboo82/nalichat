import { describe, expect, it } from 'vitest';
import { getTrackRegionRenderSchedule } from '../lib/audioProcessing';

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

  it('supports legacy unsplit tracks using their start and clip offsets', () => {
    const track = { startTime: 3, duration: 2, clipStart: 4 };

    expect(getTrackRegionRenderSchedule(track, 10)).toEqual([
      { timelineStart: 3, sourceStart: 4, duration: 2 },
    ]);
  });
});
