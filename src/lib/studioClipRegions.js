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
