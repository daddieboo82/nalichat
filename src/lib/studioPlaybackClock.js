import { studioPlaybackPosition } from './studioPlaybackPosition.js';

// For one audible audio source the media clock is authoritative. Seeking that
// source to a slower animation clock can repeat words on a busy phone.
export function studioSinglePlaybackClock({ tracks, elements, previousTime, reviewOnly = false }) {
  const solo = !reviewOnly && tracks.some(track => track.solo);
  const audible = tracks.filter(track => track.audioUrl &&
    (reviewOnly || (!track.muted && (!solo || track.solo))));
  if (audible.length !== 1) return null;
  const [track] = audible;
  const audio = elements[track.id];
  const result = { trackId: track.id, time: null };
  if (!audio || audio.seeking || audio.readyState < 2 ||
      audio.dataset?.srcUrl !== track.audioUrl || !Number.isFinite(audio.currentTime) ||
      !studioPlaybackPosition(track, previousTime).active) return result;

  const start = Number(track.startTime ?? 0);
  const end = start + Number(track.duration);
  const mediaTime = start + audio.currentTime - Number(track.clipStart ?? 0);
  // An ended player also reports paused. Move outside the clip in that case
  // so the boundary loop cannot restart the source as if it were buffering.
  if (audio.ended || mediaTime >= end) return { trackId: track.id, time: end };
  if (audio.paused) return result;
  if (!studioPlaybackPosition(track, mediaTime).active) return result;
  return { trackId: track.id, time: Math.max(previousTime, mediaTime) };
}

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
    if (mediaTimelineTime < start || mediaTimelineTime >= start + duration) {
      // This current player is still marked as playing outside its own
      // timeline clip. It cannot be a trustworthy playback clock, and its
      // disagreement must not be hidden by another valid track.
      conflictingPlayback = true;
      continue;
    }
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

// Correct only sustained, clearly measured playback drift. Never seek a
// buffering, paused, stale or already-seeking element, or alter its pitch.
export function studioPlaybackDriftTarget({audio, track, position, recording=false, tolerance=0.18}={}) {
  if(recording || !position?.active || !audio || !track?.audioUrl ||
      audio.dataset?.srcUrl !== track.audioUrl || audio.paused || audio.ended ||
      audio.seeking || audio.readyState < 3 ||
      !Number.isFinite(audio.currentTime) || !Number.isFinite(position.sourceTime) ||
      position.sourceTime < 0 || !Number.isFinite(tolerance) || tolerance <= 0) return null;
  if(Number.isFinite(audio.duration) && position.sourceTime >= audio.duration) return null;
  return Math.abs(audio.currentTime-position.sourceTime) >= tolerance ? position.sourceTime : null;
}
