import { describe, expect, it } from 'vitest';
import { createStudioKeyHandler } from '../lib/studioKeyHandler';

const makeTrack = () => ({
  id: 1,
  startTime: 0,
  duration: 8,
  fullDuration: 10,
  clipRegions: [
    { id: 'region-a', timelineStart: 0, sourceStart: 0, sourceEnd: 2 },
    { id: 'region-b', timelineStart: 4, sourceStart: 2, sourceEnd: 5 },
    { id: 'region-c', timelineStart: 6, sourceStart: 5, sourceEnd: 7 },
  ],
});

function runNudge({ track, selectedClipRegion = null, editMode = 'slip', key = 'ArrowRight', nudgeValue = 1 }) {
  let update;
  const handler = createStudioKeyHandler({
    selectedTrackIds: [track.id],
    selectedClipRegion,
    editMode,
    nudgeValue,
    setTracksWithHistory: updater => { update = updater; },
  });
  handler({
    key,
    shiftKey: true,
    ctrlKey: false,
    metaKey: false,
    target: { tagName: 'DIV' },
    preventDefault() {},
  });
  return update([track])[0];
}

describe('Studio region-aware keyboard nudge', () => {
  it('nudges only the selected region when a region is selected', () => {
    const result = runNudge({
      track: makeTrack(),
      selectedClipRegion: '1:region-b',
      nudgeValue: 0.5,
    });

    expect(result.clipRegions.map(region => [region.id, region.timelineStart])).toEqual([
      ['region-a', 0],
      ['region-b', 4.5],
      ['region-c', 6],
    ]);
  });

  it('uses Shuffle collision behavior when nudging a selected region', () => {
    const result = runNudge({
      track: makeTrack(),
      selectedClipRegion: '1:region-b',
      editMode: 'shuffle',
      nudgeValue: 2.5,
    });

    expect(result.clipRegions.map(region => [region.id, region.timelineStart])).toEqual([
      ['region-a', 0],
      ['region-b', 6.5],
      ['region-c', 9.5],
    ]);
  });

  it('nudges every region on selected tracks together when no region is selected', () => {
    const result = runNudge({
      track: makeTrack(),
      selectedClipRegion: null,
      nudgeValue: 1,
    });

    expect(result.clipRegions.map(region => region.timelineStart)).toEqual([1, 5, 7]);
  });
});
