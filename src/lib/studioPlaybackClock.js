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
        mediaTimelineTime > expectedTime + frameGapSeconds + 0.15) continue;
    return mediaTimelineTime;
  }
  return expectedTime;
}
