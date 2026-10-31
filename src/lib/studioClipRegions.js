/**
 * Clip-region primitives for NaliStudio's non-destructive timeline model.
 *
 * A track owns the audio source and mixer channel. Regions own independent
 * timeline placement and source in/out points. Keeping these separate is the
 * foundation for same-lane split, trim, slip, shuffle, and crossfade editing.
 */

const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeClipRegion(region, fallbackId = 'region') {
  if (!region || typeof region !== 'object') return null;
  const sourceStart = Math.max(0, finite(region.sourceStart, 0));
  const sourceEnd = finite(region.sourceEnd, NaN);
  const timelineStart = Math.max(0, finite(region.timelineStart, 0));
  if (!Number.isFinite(sourceEnd) || sourceEnd <= sourceStart) return null;
  return {
    id: String(region.id ?? fallbackId),
    timelineStart,
    sourceStart,
    sourceEnd,
    fadeIn: Math.max(0, finite(region.fadeIn, 0)),
    fadeOut: Math.max(0, finite(region.fadeOut, 0)),
    gainDb: finite(region.gainDb, 0),
  };
}

export function getTrackClipRegions(track) {
  if (!track || typeof track !== 'object') return [];
  if (Array.isArray(track.clipRegions)) {
    return track.clipRegions
      .map((region, index) => normalizeClipRegion(region, `region-${track.id}-${index}`))
      .filter(Boolean)
      .sort((a, b) => a.timelineStart - b.timelineStart);
  }
  const duration = Math.max(0, finite(track.duration, 40));
  const sourceStart = Math.max(0, finite(track.clipStart, 0));
  if (!duration) return [];
  const region = normalizeClipRegion({
    id: `region-${track.id}-0`,
    timelineStart: Math.max(0, finite(track.startTime, 0)),
    sourceStart,
    sourceEnd: sourceStart + duration,
    fadeIn: track.fadeIn,
    fadeOut: track.fadeOut,
    gainDb: track.clipGain,
  });
  return region ? [region] : [];
}

/** Split the region under an absolute timeline position without creating a track. */
export function splitTrackRegion(track, timelineTime, createId = (() => 'region')) {
  const time = finite(timelineTime, NaN);
  if (!track || !Number.isFinite(time)) return { ...track, clipRegions: getTrackClipRegions(track) };
  const regions = getTrackClipRegions(track);
  const index = regions.findIndex(region =>
    time > region.timelineStart && time < region.timelineStart + (region.sourceEnd - region.sourceStart)
  );
  if (index < 0) return { ...track, clipRegions: regions };
  const region = regions[index];
  const leftDuration = time - region.timelineStart;
  const sourceSplit = region.sourceStart + leftDuration;
  const left = {
    ...region,
    id: createId('left', region),
    sourceEnd: sourceSplit,
    fadeOut: 0,
  };
  const right = {
    ...region,
    id: createId('right', region),
    timelineStart: time,
    sourceStart: sourceSplit,
    fadeIn: 0,
  };
  const next = [...regions];
  next.splice(index, 1, left, right);
  return { ...track, clipRegions: next };
}

/** Join adjacent regions only when their timeline and source edges are contiguous. */
export function healTrackRegions(track, regionId) {
  const regions = getTrackClipRegions(track);
  const index = regions.findIndex(region => region.id === regionId);
  if (index < 0 || index >= regions.length - 1) return { ...track, clipRegions: regions, healed: false };
  const left = regions[index];
  const right = regions[index + 1];
  const timelineAdjacent = Math.abs(
    left.timelineStart + left.sourceEnd - left.sourceStart - right.timelineStart
  ) < 0.001;
  const sourceAdjacent = Math.abs(left.sourceEnd - right.sourceStart) < 0.001;
  if (!timelineAdjacent || !sourceAdjacent) return { ...track, clipRegions: regions, healed: false };
  const merged = { ...left, sourceEnd: right.sourceEnd, fadeOut: right.fadeOut };
  const next = [...regions];
  next.splice(index, 2, merged);
  return { ...track, clipRegions: next, healed: true };
}


/** Move a region on the timeline without changing which source audio it references. */
export function moveClipRegion(track, regionId, timelineStart) {
  const start = Math.max(0, finite(timelineStart, NaN));
  if (!Number.isFinite(start)) return track;
  return {
    ...track,
    clipRegions: getTrackClipRegions(track).map(region =>
      region.id === regionId ? { ...region, timelineStart: start } : region
    ).sort((a, b) => a.timelineStart - b.timelineStart),
  };
}

/** Slip-edit a region: preserve its timeline position and length, move source in/out together. */
export function slipClipRegion(track, regionId, sourceStart, sourceDuration) {
  const start = Math.max(0, finite(sourceStart, NaN));
  const duration = Math.max(0.001, finite(sourceDuration, NaN));
  if (!Number.isFinite(start) || !Number.isFinite(duration)) return track;
  return {
    ...track,
    clipRegions: getTrackClipRegions(track).map(region => region.id === regionId
      ? { ...region, sourceStart: start, sourceEnd: start + duration }
      : region
    ),
  };
}

/** Trim the left edge non-destructively; move timeline and source starts together. */
export function trimClipRegionLeft(track, regionId, timelineDelta) {
  const delta = finite(timelineDelta, NaN);
  if (!Number.isFinite(delta)) return track;
  return {
    ...track,
    clipRegions: getTrackClipRegions(track).map(region => {
      if (region.id !== regionId) return region;
      const length = region.sourceEnd - region.sourceStart;
      const applied = Math.max(-region.timelineStart, Math.min(delta, length - 0.001));
      return {
        ...region,
        timelineStart: region.timelineStart + applied,
        sourceStart: region.sourceStart + applied,
        fadeIn: 0,
      };
    }),
  };
}

/** Trim the right edge non-destructively by changing only the source out point. */
export function trimClipRegionRight(track, regionId, timelineDelta) {
  const delta = finite(timelineDelta, NaN);
  if (!Number.isFinite(delta)) return track;
  return {
    ...track,
    clipRegions: getTrackClipRegions(track).map(region => {
      if (region.id !== regionId) return region;
      const nextEnd = Math.max(region.sourceStart + 0.001, region.sourceEnd + delta);
      return { ...region, sourceEnd: nextEnd, fadeOut: 0 };
    }),
  };
}

/** Cut away one side of a region at an absolute timeline position. */
export function cutClipRegionSide(track, regionId, timelineCut) {
  const cut = finite(timelineCut, NaN);
  if (!Number.isFinite(cut)) return { ...track, clipRegions: getTrackClipRegions(track), removed: false };
  const regions = getTrackClipRegions(track);
  const index = regions.findIndex(region => region.id === regionId);
  if (index < 0) return { ...track, clipRegions: regions, removed: false };
  const region = regions[index];
  const end = region.timelineStart + region.sourceEnd - region.sourceStart;
  if (cut <= region.timelineStart || cut >= end) return { ...track, clipRegions: regions, removed: false };
  const leftLength = cut - region.timelineStart;
  const rightSourceStart = region.sourceStart + leftLength;
  const keepRight = cut - region.timelineStart < (end - region.timelineStart) / 2;
  const kept = keepRight
    ? { ...region, timelineStart: cut, sourceStart: rightSourceStart, fadeIn: 0 }
    : { ...region, sourceEnd: rightSourceStart, fadeOut: 0 };
  const next = [...regions];
  next.splice(index, 1, kept);
  return { ...track, clipRegions: next, removed: true };
}
