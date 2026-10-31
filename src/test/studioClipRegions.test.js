import { describe, expect, it } from 'vitest';
import {
  cutClipRegionSide,
  deleteClipRegion,
  cutTrackTimelineRange,
  getClipRegionAtTime,
  getClipSourceTimeAtTime,
  getGridIntervalSeconds,
  getHealCandidateRegionIds,
  getTrackClipRegions,
  healTrackRegions,
  moveClipRegion,
  moveTrackClipRegions,
  rebaseClipRegionsToRenderedTimeline,
  remapClipRegionSources,
  shuffleMoveClipRegion,
  setClipRegionGain,
  slipClipRegion,
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
  it('orders selected-region Heal boundaries by proximity to the playhead', () => {
    const regions = [
      { id: 'left', timelineStart: 0, sourceStart: 0, sourceEnd: 2 },
      { id: 'middle', timelineStart: 2, sourceStart: 2, sourceEnd: 6 },
      { id: 'right', timelineStart: 6, sourceStart: 6, sourceEnd: 10 },
    ];

    expect(getHealCandidateRegionIds(regions, 'middle', 5.5)).toEqual(['middle', 'left']);
    expect(getHealCandidateRegionIds(regions, 'middle', 0.5)).toEqual(['left', 'middle']);
    expect(getHealCandidateRegionIds(regions, null, 5)).toEqual(['middle', 'left']);
    expect(getHealCandidateRegionIds(regions, 'missing', 0.5)).toEqual(['left', 'middle']);
  });

  it('increments the region revision for edits that require realtime audio resync', () => {
    const track = makeTrack();
    const cut = cutClipRegionSide(track, 'region-1', 4, { direction: 'right' });
    const slip = slipClipRegion(track, 'region-1', 0.02);
    const split = splitTrackRegion(track, 4, side => `rev-${side}`);

    expect(cut.clipRegionRevision).toBe(1);
    expect(slip.clipRegionRevision).toBe(1);
    expect(split.clipRegionRevision).toBe(1);
  });

  it('maps timeline positions to the correct source region and leaves gaps silent', () => {
    const track = {
      clipRegions: [
        { id: 'first', timelineStart: 2, sourceStart: 1, sourceEnd: 3 },
        { id: 'second', timelineStart: 6, sourceStart: 5, sourceEnd: 8 },
      ],
    };

    expect(getClipRegionAtTime(track, 2)?.id).toBe('first');
    expect(getClipSourceTimeAtTime(track, 3.5)).toBe(2.5);
    expect(getClipRegionAtTime(track, 4)).toBeNull();
    expect(getClipSourceTimeAtTime(track, 4)).toBeNull();
    expect(getClipRegionAtTime(track, 8)).toBeNull();
  });

  it('converts musical grid subdivisions into seconds using tempo and meter', () => {
    expect(getGridIntervalSeconds(1, 120, '4/4')).toBe(2);
    expect(getGridIntervalSeconds(0.25, 120, '4/4')).toBe(0.5);
    expect(getGridIntervalSeconds(1, 120, '6/8')).toBe(1.5);
    expect(getGridIntervalSeconds(1, 60, '4/4')).toBe(4);
  });

  it('cuts away the audio before the cut point and keeps the right side on the same track', () => {
    const track = makeTrack();
    const result = cutClipRegionSide(track, 'region-1', 3, { direction: 'left' });
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
    const result = cutClipRegionSide(track, 'region-1', 7, { direction: 'right' });
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

  it('removes the selected In/Out range and leaves both sides on the same track', () => {
    const track = makeTrack();
    const result = cutTrackTimelineRange(track, 3, 7, {
      createId: (side, region) => `${region.id}-${side}`,
    });

    expect(result.id).toBe(track.id);
    expect(result.removed).toBe(true);
    expect(result.clipRegions).toHaveLength(2);
    expect(result.clipRegions[0]).toMatchObject({
      timelineStart: 0,
      sourceStart: 0,
      sourceEnd: 3,
    });
    expect(result.clipRegions[1]).toMatchObject({
      timelineStart: 7,
      sourceStart: 7,
      sourceEnd: 10,
    });
  });

  it('Shuffle range cuts ripple later regions left and preserve silence gaps', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 10 },
        { id: 'b', timelineStart: 12, sourceStart: 0, sourceEnd: 2 },
      ],
    };
    const result = cutTrackTimelineRange(track, 3, 7, {
      shuffle: true,
      createId: (side, region) => `${region.id}-${side}`,
    });

    expect(result.clipRegions.map(region => [region.id, region.timelineStart])).toEqual([
      ['a', 0],
      ['a-right', 3],
      ['b', 8],
    ]);
    expect(result.clipRegions[1]).toMatchObject({ sourceStart: 7, sourceEnd: 10 });
  });

  it('keeps the track but collapses its clip container when a range removes all audio', () => {
    const result = cutTrackTimelineRange(makeTrack(), 0, 10);

    expect(result.id).toBe('track-1');
    expect(result.removed).toBe(true);
    expect(result.clipRegions).toEqual([]);
    expect(result.duration).toBe(0);
  });

  it('does not report a range cut when the selection contains no audio', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [{ id: 'region', timelineStart: 0, sourceStart: 0, sourceEnd: 2 }],
    };
    const result = cutTrackTimelineRange(track, 3, 5);

    expect(result.removed).toBe(false);
    expect(result.clipRegions).toEqual(track.clipRegions);
  });

  it('uses Remove Right at any cut point, independent of which half was clicked', () => {
    const track = makeTrack();
    const result = cutClipRegionSide(track, 'region-1', 2, { direction: 'right' });

    expect(result.clipRegions[0]).toMatchObject({
      timelineStart: 0,
      sourceStart: 0,
      sourceEnd: 2,
    });
  });

  it('uses Remove Left at any cut point, independent of which half was clicked', () => {
    const track = makeTrack();
    const result = cutClipRegionSide(track, 'region-1', 8, { direction: 'left' });

    expect(result.clipRegions[0]).toMatchObject({
      timelineStart: 8,
      sourceStart: 8,
      sourceEnd: 10,
    });
  });

  it('deletes one selected region but retains the original track and other regions', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'left', timelineStart: 0, sourceStart: 0, sourceEnd: 2 },
        { id: 'middle', timelineStart: 4, sourceStart: 2, sourceEnd: 4 },
        { id: 'right', timelineStart: 8, sourceStart: 4, sourceEnd: 6 },
      ],
    };
    const result = deleteClipRegion(track, 'middle');

    expect(result.id).toBe(track.id);
    expect(result.removed).toBe(true);
    expect(result.clipRegions.map(region => [region.id, region.timelineStart])).toEqual([
      ['left', 0],
      ['right', 8],
    ]);
  });

  it('Shuffle Delete closes the removed region duration and preserves later gaps', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'left', timelineStart: 0, sourceStart: 0, sourceEnd: 2 },
        { id: 'middle', timelineStart: 4, sourceStart: 2, sourceEnd: 4 },
        { id: 'right', timelineStart: 8, sourceStart: 4, sourceEnd: 6 },
      ],
    };
    const result = deleteClipRegion(track, 'middle', { shuffle: true });

    expect(result.clipRegions.map(region => [region.id, region.timelineStart])).toEqual([
      ['left', 0],
      ['right', 6],
    ]);
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

  it('clamps a normal region move to the open gap before the next region', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'left', timelineStart: 0, sourceStart: 0, sourceEnd: 3 },
        { id: 'middle', timelineStart: 5, sourceStart: 3, sourceEnd: 6 },
        { id: 'right', timelineStart: 10, sourceStart: 6, sourceEnd: 9 },
      ],
    };
    const result = moveClipRegion(track, 'middle', 9);

    expect(result.clipRegions.map(region => region.timelineStart)).toEqual([0, 7, 10]);
    expect(result.clipRegions[1].timelineStart + 3).toBeLessThanOrEqual(result.clipRegions[2].timelineStart);
  });

  it('clamps a normal region move after the previous region', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'left', timelineStart: 0, sourceStart: 0, sourceEnd: 3 },
        { id: 'middle', timelineStart: 5, sourceStart: 3, sourceEnd: 6 },
        { id: 'right', timelineStart: 10, sourceStart: 6, sourceEnd: 9 },
      ],
    };
    const result = moveClipRegion(track, 'middle', 0);

    expect(result.clipRegions.map(region => region.timelineStart)).toEqual([0, 3, 10]);
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

  it('clamps whole-track movement at zero without collapsing internal spacing', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'left', timelineStart: 2, sourceStart: 0, sourceEnd: 3 },
        { id: 'right', timelineStart: 7, sourceStart: 3, sourceEnd: 6 },
      ],
    };
    const result = moveTrackClipRegions(track, -5);

    expect(result.clipRegions.map(region => region.timelineStart)).toEqual([0, 5]);
    expect(result.duration).toBe(8);
  });

  it('keeps legacy track clip gain separate from region-level gain', () => {
    const legacy = getTrackClipRegions({
      id: 'legacy',
      startTime: 2,
      duration: 4,
      clipStart: 1,
      clipGain: -6,
    });

    expect(legacy).toHaveLength(1);
    expect(legacy[0].gainDb).toBe(0);
  });

  it('preserves the original source duration when a region is first split', () => {
    const track = { ...makeTrack(), fullDuration: undefined };
    const result = splitTrackRegion(track, 4, side => `split-${side}`);

    expect(result.fullDuration).toBe(10);
  });

  it('rebases source offsets to rendered timeline positions after Track Commit', () => {
    const regions = [
      { id: 'first', timelineStart: 4, sourceStart: 0, sourceEnd: 2 },
      { id: 'second', timelineStart: 9, sourceStart: 5, sourceEnd: 8 },
    ];
    const result = rebaseClipRegionsToRenderedTimeline(regions);

    expect(result.map(region => [
      region.timelineStart,
      region.sourceStart,
      region.sourceEnd,
    ])).toEqual([
      [4, 4, 6],
      [9, 9, 12],
    ]);
  });

  it('clears region gain and fades after Track Commit bakes them into the rendered audio', () => {
    const regions = [{
      id: 'processed',
      timelineStart: 3,
      sourceStart: 1,
      sourceEnd: 5,
      gainDb: -8,
      fadeIn: 0.4,
      fadeOut: 0.6,
    }];

    const result = rebaseClipRegionsToRenderedTimeline(regions, {
      resetGain: true,
      resetFades: true,
    });

    expect(result[0]).toMatchObject({
      timelineStart: 3,
      sourceStart: 3,
      sourceEnd: 7,
      gainDb: 0,
      fadeIn: 0,
      fadeOut: 0,
    });
  });

  it('preserves region gain and fades when rebasing without baking controls', () => {
    const result = rebaseClipRegionsToRenderedTimeline([{
      id: 'preserved',
      timelineStart: 2,
      sourceStart: 0,
      sourceEnd: 3,
      gainDb: -5,
      fadeIn: 0.2,
      fadeOut: 0.3,
    }]);

    expect(result[0]).toMatchObject({
      gainDb: -5,
      fadeIn: 0.2,
      fadeOut: 0.3,
    });
  });

  it('mirrors clip source ranges when AudioSuite reverses the source file', () => {
    const regions = [
      { id: 'first', timelineStart: 3, sourceStart: 1, sourceEnd: 4, fadeIn: 0.2, fadeOut: 0.4 },
      { id: 'second', timelineStart: 8, sourceStart: 5, sourceEnd: 9 },
    ];
    const result = remapClipRegionSources(regions, 10, 'reverse');

    expect(result.map(region => [region.id, region.timelineStart, region.sourceStart, region.sourceEnd])).toEqual([
      ['first', 3, 6, 9],
      ['second', 8, 1, 5],
    ]);
    expect(result[0]).toMatchObject({ fadeIn: 0.4, fadeOut: 0.2 });
  });

  it('scales clip source ranges after AudioSuite pitch or time-stretch resampling', () => {
    const regions = [{ id: 'region', timelineStart: 2, sourceStart: 2, sourceEnd: 6 }];
    const result = remapClipRegionSources(regions, 5, 'stretch', 0.5);

    expect(result[0]).toMatchObject({
      id: 'region',
      timelineStart: 2,
      sourceStart: 1,
      sourceEnd: 3,
    });
  });

  it('drops source regions that become empty after AudioSuite duration changes', () => {
    const regions = [{ id: 'tail', timelineStart: 2, sourceStart: 8, sourceEnd: 10 }];
    expect(remapClipRegionSources(regions, 5, 'stretch', 0.5)).toEqual([]);
  });

  it('Slip mode moves source audio while preserving region timeline placement and duration', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [{ id: 'region-1', timelineStart: 5, sourceStart: 2, sourceEnd: 5 }],
    };
    const result = slipClipRegion(track, 'region-1', 3);

    expect(result.startTime).toBe(0);
    expect(result.duration).toBe(10);
    expect(result.clipRegions[0]).toMatchObject({
      timelineStart: 5,
      sourceStart: 5,
      sourceEnd: 8,
    });
    expect(result).not.toHaveProperty('lastSlipDelta');
  });

  it('Slip mode clamps source movement to the beginning and end of the source file', () => {
    const track = {
      ...makeTrack(),
      fullDuration: 10,
      clipRegions: [{ id: 'region-1', timelineStart: 5, sourceStart: 2, sourceEnd: 5 }],
    };

    const beforeStart = slipClipRegion(track, 'region-1', -10);
    expect(beforeStart.clipRegions[0]).toMatchObject({ sourceStart: 0, sourceEnd: 3 });

    const afterEnd = slipClipRegion(track, 'region-1', 20);
    expect(afterEnd.clipRegions[0]).toMatchObject({ sourceStart: 7, sourceEnd: 10 });
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
    expect(rightExtended.duration).toBe(8);
  });

  it('limits a normal left trim extension to the previous region boundary', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'previous', timelineStart: 0, sourceStart: 0, sourceEnd: 3 },
        { id: 'target', timelineStart: 5, sourceStart: 3, sourceEnd: 6 },
      ],
    };
    const result = trimClipRegionLeft(track, 'target', -4);

    expect(result.clipRegions.map(region => region.timelineStart)).toEqual([0, 3]);
    expect(result.clipRegions[1].sourceStart).toBe(1);
    expect(result.clipRegions[0].timelineStart + 3).toBeLessThanOrEqual(result.clipRegions[1].timelineStart);
  });

  it('limits a normal right trim extension to the next region boundary', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'target', timelineStart: 0, sourceStart: 0, sourceEnd: 3 },
        { id: 'next', timelineStart: 5, sourceStart: 3, sourceEnd: 6 },
      ],
    };
    const result = trimClipRegionRight(track, 'target', 4);

    expect(result.clipRegions[0].sourceEnd).toBe(5);
    expect(result.clipRegions[1].timelineStart).toBe(5);
    expect(result.clipRegions[0].timelineStart + 5).toBeLessThanOrEqual(result.clipRegions[1].timelineStart);
  });

  it('preserves existing gaps outside Shuffle collision chains', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'a', timelineStart: 0, sourceStart: 0, sourceEnd: 2 },
        { id: 'b', timelineStart: 8, sourceStart: 2, sourceEnd: 4 },
      ],
    };
    const result = shuffleMoveClipRegion(track, 'a', 4);

    expect(result.clipRegions.find(region => region.id === 'a').timelineStart).toBe(4);
    expect(result.clipRegions.find(region => region.id === 'b').timelineStart).toBe(8);
  });

  it('preserves clip gain on both halves when splitting a waveform region', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [{
        id: 'original',
        timelineStart: 0,
        sourceStart: 0,
        sourceEnd: 10,
        gainDb: -7,
        fadeIn: 0.2,
        fadeOut: 0.3,
      }],
    };

    const result = splitTrackRegion(track, 4, side => `split-${side}`);

    expect(result.clipRegions.map(region => region.gainDb)).toEqual([-7, -7]);
    expect(result.clipRegions[0].fadeIn).toBe(0.2);
    expect(result.clipRegions[1].fadeOut).toBe(0.3);
  });

  it('preserves region gain through Slip, Shuffle move, and side Cut edits', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'edited', timelineStart: 0, sourceStart: 0, sourceEnd: 4, gainDb: -6 },
        { id: 'later', timelineStart: 6, sourceStart: 4, sourceEnd: 8, gainDb: 3 },
      ],
    };

    const slipped = slipClipRegion(track, 'edited', 1);
    const shuffled = shuffleMoveClipRegion(slipped, 'edited', 2);
    const cut = cutClipRegionSide(shuffled, 'edited', 3, { direction: 'right' });

    expect(slipped.clipRegions.find(region => region.id === 'edited').gainDb).toBe(-6);
    expect(shuffled.clipRegions.find(region => region.id === 'edited').gainDb).toBe(-6);
    expect(cut.clipRegions.find(region => region.id === 'edited').gainDb).toBe(-6);
    expect(cut.clipRegions.find(region => region.id === 'later').gainDb).toBe(3);
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

  it('sets gain on only the selected region and increments the edit revision', () => {
    const track = {
      ...makeTrack(),
      clipRegionRevision: 4,
      clipRegions: [
        { id: 'left', timelineStart: 0, sourceStart: 0, sourceEnd: 4, gainDb: 0 },
        { id: 'right', timelineStart: 4, sourceStart: 4, sourceEnd: 8, gainDb: -3 },
      ],
    };

    const result = setClipRegionGain(track, 'right', -9);

    expect(result.clipRegions.map(region => region.gainDb)).toEqual([0, -9]);
    expect(result.clipRegionRevision).toBe(4);
    expect(result.clipRegions.map(region => [region.timelineStart, region.sourceStart, region.sourceEnd]))
      .toEqual([[0, 0, 4], [4, 4, 8]]);
  });

  it('preserves region gain through non-destructive left and right trims', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [{
        id: 'trimmed',
        timelineStart: 0,
        sourceStart: 0,
        sourceEnd: 10,
        gainDb: 5,
      }],
    };

    const leftTrim = trimClipRegionLeft(track, 'trimmed', 1);
    const rightTrim = trimClipRegionRight(track, 'trimmed', -1);

    expect(leftTrim.clipRegions[0].gainDb).toBe(5);
    expect(rightTrim.clipRegions[0].gainDb).toBe(5);
  });

  it('clamps region gain to the supported plus/minus 12 dB range', () => {
    const loud = setClipRegionGain(makeTrack(), 'region-1', 40);
    const quiet = setClipRegionGain(makeTrack(), 'region-1', -40);

    expect(loud.clipRegions[0].gainDb).toBe(12);
    expect(quiet.clipRegions[0].gainDb).toBe(-12);
  });

  it('refuses to heal adjacent regions with different clip gain', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'left', timelineStart: 0, sourceStart: 0, sourceEnd: 4, gainDb: 0 },
        { id: 'right', timelineStart: 4, sourceStart: 4, sourceEnd: 8, gainDb: -6 },
      ],
    };

    const result = healTrackRegions(track, 'left');

    expect(result.healed).toBe(false);
    expect(result.clipRegions).toHaveLength(2);
    expect(result.clipRegions.map(region => region.gainDb)).toEqual([0, -6]);
  });

  it('refuses to heal when either region has a fade at the internal seam', () => {
    const track = {
      ...makeTrack(),
      clipRegions: [
        { id: 'left', timelineStart: 0, sourceStart: 0, sourceEnd: 4, fadeOut: 0.25 },
        { id: 'right', timelineStart: 4, sourceStart: 4, sourceEnd: 8, fadeIn: 0.25 },
      ],
    };

    const result = healTrackRegions(track, 'left');

    expect(result.healed).toBe(false);
    expect(result.clipRegions).toHaveLength(2);
    expect(result.clipRegions[0].fadeOut).toBe(0.25);
    expect(result.clipRegions[1].fadeIn).toBe(0.25);
  });
});
