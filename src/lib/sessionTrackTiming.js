// Non-destructive alignment for remote collaborative tracks.
// Each independently recorded take has a shared-session start position.
// It is NOT a measurement of network latency or automatic clock sync.
export function sessionTrackStart(track) {
  const n = Number(track?.startTime ?? track?.start_time ?? 0);
  return Number.isFinite(n) && n >= 0 && n <= 86400 ? n : 0;
}
export function sessionTrackLocalTime(track, timelineSeconds) {
  const value = Number(timelineSeconds) - sessionTrackStart(track);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}
export function sessionTrackShouldPlay(track, timelineSeconds, duration) {
  const local = Number(timelineSeconds) - sessionTrackStart(track);
  return Number.isFinite(local) && local >= 0 &&
    (!Number.isFinite(duration) || duration <= 0 || local < duration);
}
export function sessionTrackEnd(track, duration) {
  const length = Number.isFinite(duration) && duration > 0 ? duration : Number(track?.duration) || 0;
  return sessionTrackStart(track) + Math.max(0, length);
}
export function nextSessionTrackStart(current, delta) {
  if (!Number.isFinite(delta)) throw new Error('Invalid alignment change');
  return Math.round(Math.min(86400, Math.max(0, sessionTrackStart(current) + delta)) * 100) / 100;
}
