// Destructive-looking (but reversible via history) clip trim. Retain the
// existing track identity and source URL, so exports and autosaves keep working.
export function cutStudioClipAtPointer(track, fraction) {
  const start = Number.isFinite(track.startTime) ? track.startTime : 0;
  const duration = Number.isFinite(track.duration) ? track.duration : 0;
  const sourceOffset = Number.isFinite(track.clipStart) ? track.clipStart : 0;
  if (!Number.isFinite(fraction) || duration <= 0) {
    return { clip: track, changed: false };
  }
  const ratio = Math.min(1, Math.max(0, fraction));
  const left = duration * ratio;
  const right = duration - left;
  if (left <= 0.001 || right <= 0.001) {
    return { clip: track, changed: false };
  }
  const side = ratio < 0.5 ? 'left' : 'right';
  const clip = side === 'left'
    ? { ...track, startTime: start + left, clipStart: sourceOffset + left, duration: right }
    : { ...track, duration: left };
  return { clip, side, cutTime: start + left, changed: true };
}
