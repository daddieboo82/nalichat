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
    tracks: [track],
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

function runDelete({ track, selectedClipRegion, editMode = 'slip' }) {
  let update;
  let clearedSelection = false;
  let deletedTracks = false;
  const handler = createStudioKeyHandler({
    tracks: [track],
    selectedTrackIds: [track.id],
    selectedClipRegion,
    editMode,
    setTracksWithHistory: updater => { update = updater; },
    setSelectedClipRegion: value => { clearedSelection = value === null; },
    deleteSelectedTracks: () => { deletedTracks = true; },
  });
  handler({
    key: 'Delete',
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    target: { tagName: 'DIV' },
    preventDefault() {},
  });
  return {
    result: update ? update([track])[0] : track,
    clearedSelection,
    deletedTracks,
  };
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

describe('Studio region-aware Delete', () => {
  const makeDeleteTrack = (locked = false) => ({
    id: 7,
    startTime: 0,
    duration: 10,
    fullDuration: 12,
    locked,
    clipRegions: [
      { id: 'left', timelineStart: 0, sourceStart: 0, sourceEnd: 2 },
      { id: 'selected', timelineStart: 4, sourceStart: 2, sourceEnd: 4 },
      { id: 'right', timelineStart: 8, sourceStart: 4, sourceEnd: 6 },
    ],
  });

  it('Delete removes only the selected region and retains the track', () => {
    const { result, clearedSelection, deletedTracks } = runDelete({
      track: makeDeleteTrack(),
      selectedClipRegion: '7:selected',
    });

    expect(result.id).toBe(7);
    expect(result.clipRegions.map(region => region.id)).toEqual(['left', 'right']);
    expect(result.clipRegions.map(region => region.timelineStart)).toEqual([0, 8]);
    expect(clearedSelection).toBe(true);
    expect(deletedTracks).toBe(false);
  });

  it('Shuffle Delete ripples later regions left by the removed region duration', () => {
    const { result } = runDelete({
      track: makeDeleteTrack(),
      selectedClipRegion: '7:selected',
      editMode: 'shuffle',
    });

    expect(result.clipRegions.map(region => [region.id, region.timelineStart])).toEqual([
      ['left', 0],
      ['right', 6],
    ]);
  });

  it('Delete still removes selected tracks when no individual region is selected', () => {
    const { result, deletedTracks } = runDelete({
      track: makeDeleteTrack(),
      selectedClipRegion: null,
    });

    expect(result).toEqual(makeDeleteTrack());
    expect(deletedTracks).toBe(true);
  });

  it('does not delete a region from a locked track', () => {
    const track = makeDeleteTrack(true);
    const { result, clearedSelection, deletedTracks } = runDelete({
      track,
      selectedClipRegion: '7:selected',
    });

    expect(result.clipRegions).toEqual(track.clipRegions);
    expect(clearedSelection).toBe(false);
    expect(deletedTracks).toBe(false);
  });
});
