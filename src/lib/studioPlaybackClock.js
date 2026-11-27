// When requestAnimationFrame stalls, HTMLMediaElement audio can continue to
// advance in the background. Re-anchor the Studio playhead to actual media
// progress only when there is a currently playing, unambiguous clip.
// Never use this correction for microphone captures, which have their own clock.
export function studioPlaybackTimeAfterStall({
  expectedTime, frameGapSeconds, tracks = [], elements = {}, recording = false,
  minGapSeconds = 0.25,
} = {}) {
  if (recording || !Number.isFinite(expectedTime) ||
      !Number.isFinite(frameGapSeconds) || frameGapSeconds <= minGapSeconds ||
      !Array.isArray(tracks)) return expectedTime;

  const solo = tracks.some(track => track.solo);
  const candidates = [];
  let conflictingPlayback = false;
  for (const track of tracks) {
    if (track.muted || (solo && !track.solo) || !track.audioUrl) continue;
    const audio = elements?.[track.id];
    if (!audio || audio.paused || audio.ended || audio.seeking ||
        audio.dataset?.srcUrl !== track.audioUrl ||
        !Number.isFinite(audio.currentTime)) continue;
    const start = Number(track.startTime ?? 0);
    const clipStart = Number(track.clipStart ?? 0);
    const duration = Number(track.duration ?? 0);
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(clipStart) ||
        clipStart < 0 || !Number.isFinite(duration) || duration <= 0) continue;
    const mediaTimelineTime = start + audio.currentTime - clipStart;
    if (mediaTimelineTime < start || mediaTimelineTime >= start + duration) continue;
    // Reject a player that could not have advanced to this point during the
    // elapsed gap. The transport may have been manually seeked meanwhile.
    if (mediaTimelineTime < expectedTime - 0.15 ||
        mediaTimelineTime > expectedTime + frameGapSeconds + 0.15) {
      // A current, playing track disagreeing with the allowed frame window
      // makes the transport clock ambiguous, even if another track looks valid.
      conflictingPlayback = true;
      continue;
    }
    candidates.push(mediaTimelineTime);
  }
  if (conflictingPlayback || !candidates.length) return expectedTime;
  // Do not let one drifting media element pull the whole transport away
  // from other audible tracks. When multiple sources disagree, retain the
  // bounded RAF fallback rather than choosing by track order.
  const earliest = Math.min(...candidates);
  const latest = Math.max(...candidates);
  if (latest - earliest > 0.15) return expectedTime;
  return candidates.reduce((total, time) => total + time, 0) / candidates.length;
}
