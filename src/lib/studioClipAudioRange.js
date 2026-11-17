// A flat Studio clip may reference only part of its source audio.
// Return the bounded source range for a Web Audio offline renderer.
export function studioClipAudioRange(track, sourceDuration) {
  const start = Number(track?.startTime ?? 0);
  const offset = Number(track?.clipStart ?? 0);
  const requested = track?.duration == null ? sourceDuration - offset : Number(track.duration);
  if (![start, offset, requested, sourceDuration].every(Number.isFinite) ||
      start < 0 || offset < 0 || requested <= 0 || sourceDuration <= 0 ||
      offset >= sourceDuration) return null;
  const duration = Math.min(requested, sourceDuration - offset);
  if (duration <= 0) return null;
  return { when: start, offset, duration, endsAt: start + duration };
}
