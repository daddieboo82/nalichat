// RequestAnimationFrame may be suspended while a browser tab is hidden.
// Its first resumed timestamp can contain a large gap even though media
// playback was suspended. Avoid visually seeking across that gap during Play.
// Active capture must continue to account for real elapsed microphone time.
export const STUDIO_PLAYBACK_MAX_FRAME_SECONDS = 0.25;

export function studioTransportFrameDelta(nowMs, previousMs, { recording = false } = {}) {
  if (!Number.isFinite(nowMs) || !Number.isFinite(previousMs)) return 0;
  const elapsed = Math.max(0, (nowMs - previousMs) / 1000);
  if (recording) return elapsed;
  return Math.min(elapsed, STUDIO_PLAYBACK_MAX_FRAME_SECONDS);
}
