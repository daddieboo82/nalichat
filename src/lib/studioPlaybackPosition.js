// Return the source offset that corresponds to a timeline position for one
// flat clip record. Split clips remain independent media elements.
export function studioPlaybackPosition(track, timelineTime) {
  const start = Number(track?.startTime ?? 0);
  const duration = Number(track?.duration ?? 0);
  const clipStart = Number(track?.clipStart ?? 0);
  if (!Number.isFinite(timelineTime) || !Number.isFinite(start) ||
      !Number.isFinite(duration) || !Number.isFinite(clipStart) ||
      start < 0 || duration <= 0 || clipStart < 0) {
    return { active: false, sourceTime: null };
  }
  if (timelineTime < start || timelineTime >= start + duration) {
    return { active: false, sourceTime: null };
  }
  return { active: true, sourceTime: clipStart + timelineTime - start };
}
