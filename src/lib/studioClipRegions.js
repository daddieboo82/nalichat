/**
 * Clip-region primitives for NaliStudio's non-destructive timeline model.
 *
 * A track owns the audio source and mixer channel. Regions own independent
 * timeline placement and source in/out points. Keeping these separate is the
 * foundation for same-lane split, trim, slip, shuffle, and crossfade editing.
 */

const finite = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

/** Convert the toolbar's bar-fraction grid setting into timeline seconds. */
export function getGridIntervalSeconds(gridSize, bpm, timeSignature = '4/4') {
  const safeBpm = Math.max(1, finite(bpm, 120));
  const [rawNumerator, rawDenominator] = String(timeSignature || '4/4').split('/');
  const numerator = Number(rawNumerator);
  const denominator = Number(rawDenominator);
  const beatsPerBar = Number.isFinite(numerator) && numerator > 0
    && Number.isFinite(denominator) && denominator > 0
    ? numerator * 4 / denominator
    : 4;
  const barsPerGrid = Math.max(0.001, finite(gridSize, 1));
  return Math.max(0.001, (60 / safeBpm) * beatsPerBar * barsPerGrid);
}

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
  return withTrackClipRegionBounds(track, next);
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
  return { ...withTrackClipRegionBounds(track, next), healed: true };
}


/** Keep the legacy clip container aligned with the outer bounds of its regions. */
export function withTrackClipRegionBounds(track, regions) {
  const ordered = [...regions].sort((a, b) => a.timelineStart - b.timelineStart);
  if (ordered.length === 0) return { ...track, clipRegions: ordered };
  const startTime = ordered[0].timelineStart;
  const endTime = ordered.reduce(
    (latest, region) => Math.max(latest, region.timelineStart + region.sourceEnd - region.sourceStart),
    startTime
  );
  const sourceLimit = Math.max(
    finite(track.fullDuration, 0),
    Math.max(0, finite(track.clipStart, 0) + finite(track.duration, 0)),
    ...ordered.map(region => region.sourceEnd)
  );
  return {
    ...track,
    startTime,
    duration: Math.max(0.001, endTime - startTime),
    fullDuration: sourceLimit,
    clipRegions: ordered,
  };
}

/** Move one region on the timeline without changing which source audio it references. */
export function moveClipRegion(track, regionId, timelineStart) {
  const start = Math.max(0, finite(timelineStart, NaN));
  if (!Number.isFinite(start)) return track;
  const regions = getTrackClipRegions(track).map(region =>
    region.id === regionId ? { ...region, timelineStart: start } : region
  );
  return withTrackClipRegionBounds(track, regions);
}

/** Move every region on a track together, preserving all internal spacing. */
export function moveTrackClipRegions(track, timelineDelta) {
  const delta = finite(timelineDelta, NaN);
  if (!Number.isFinite(delta)) return track;
  const regions = getTrackClipRegions(track).map(region => ({
    ...region,
    timelineStart: Math.max(0, region.timelineStart + delta),
  }));
  return withTrackClipRegionBounds(track, regions);
}

/**
 * Shuffle-move one region. The dragged region takes priority at the drop point;
 * any regions it collides with are pushed right, cascading as needed. Existing
 * gaps outside the collision chain remain intact.
 */
export function shuffleMoveClipRegion(track, regionId, timelineStart) {
  const start = Math.max(0, finite(timelineStart, NaN));
  if (!Number.isFinite(start)) return track;
  const regions = getTrackClipRegions(track);
  const moving = regions.find(region => region.id === regionId);
  if (!moving) return { ...track, clipRegions: regions };

  const duration = moving.sourceEnd - moving.sourceStart;
  const moved = { ...moving, timelineStart: start };
  let occupiedUntil = start + duration;
  const others = regions
    .filter(region => region.id !== regionId)
    .sort((a, b) => a.timelineStart - b.timelineStart);
  const shifted = [moved];

  others.forEach(region => {
    const regionEnd = region.timelineStart + region.sourceEnd - region.sourceStart;
    if (regionEnd <= start) {
      shifted.push(region);
      return;
    }
    if (region.timelineStart < occupiedUntil) {
      const pushed = { ...region, timelineStart: occupiedUntil };
      shifted.push(pushed);
      occupiedUntil = pushed.timelineStart + pushed.sourceEnd - pushed.sourceStart;
      return;
    }
    shifted.push(region);
    occupiedUntil = Math.max(occupiedUntil, regionEnd);
  });

  return withTrackClipRegionBounds(track, shifted);
}

/** Trim the left edge non-destructively; move timeline and source starts together. */
export function trimClipRegionLeft(track, regionId, timelineDelta) {
  const delta = finite(timelineDelta, NaN);
  if (!Number.isFinite(delta)) return track;
  const regions = getTrackClipRegions(track).map(region => {
    if (region.id !== regionId) return region;
    const length = region.sourceEnd - region.sourceStart;
    const applied = Math.max(-region.timelineStart, -region.sourceStart, Math.min(delta, length - 0.001));
    return {
      ...region,
      timelineStart: region.timelineStart + applied,
      sourceStart: region.sourceStart + applied,
      fadeIn: 0,
    };
  });
  return withTrackClipRegionBounds(track, regions);
}

/** Trim the right edge non-destructively by changing only the source out point. */
export function trimClipRegionRight(track, regionId, timelineDelta, { shuffle = false } = {}) {
  const delta = finite(timelineDelta, NaN);
  if (!Number.isFinite(delta)) return track;
  const current = getTrackClipRegions(track);
  const targetIndex = current.findIndex(region => region.id === regionId);
  if (targetIndex < 0) return { ...track, clipRegions: current };
  const sourceLimit = Math.max(
    finite(track.fullDuration, 0),
    Math.max(0, finite(track.clipStart, 0) + finite(track.duration, 0)),
    ...current.map(region => region.sourceEnd)
  );
  const target = current[targetIndex];
  const nextEnd = Math.min(
    sourceLimit,
    Math.max(target.sourceStart + 0.001, target.sourceEnd + delta)
  );
  const appliedDelta = nextEnd - target.sourceEnd;
  const regions = current.map((region, index) => {
    if (index === targetIndex) return { ...region, sourceEnd: nextEnd, fadeOut: 0 };
    if (shuffle && index > targetIndex) {
      return { ...region, timelineStart: Math.max(0, region.timelineStart + appliedDelta) };
    }
    return region;
  });
  return withTrackClipRegionBounds(track, regions);
}

/** Cut away one side of a region at an absolute timeline position. */
export function cutClipRegionSide(track, regionId, timelineCut, { shuffle = false } = {}) {
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
  const removedDuration = keepRight ? leftLength : end - cut;
  const kept = keepRight
    ? { ...region, timelineStart: shuffle ? region.timelineStart : cut, sourceStart: rightSourceStart, fadeIn: 0 }
    : { ...region, sourceEnd: rightSourceStart, fadeOut: 0 };
  const next = regions.map((item, itemIndex) => {
    if (itemIndex === index) return kept;
    if (shuffle && itemIndex > index) {
      return { ...item, timelineStart: Math.max(0, item.timelineStart - removedDuration) };
    }
    return item;
  });
  return { ...withTrackClipRegionBounds(track, next), removed: true };
}
