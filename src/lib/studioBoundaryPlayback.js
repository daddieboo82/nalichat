// Each split-clip start owns its pending marker. An older asynchronous play()
// rejection must never poison a new start after Seek, Stop, or audio replacement.
export function startStudioBoundaryPlayback({
  trackId, audio, starting, failed, isCurrent = () => true, onError,
}) {
  if (!audio || starting.has(trackId) || failed.has(trackId)) return false;
  const token = { audio };
  starting.set(trackId, token);
  let result;
  try {
    result = audio.play();
  } catch (error) {
    if (starting.get(trackId) === token && isCurrent()) {
      failed.add(trackId);
      onError?.(error);
    }
    if (starting.get(trackId) === token) starting.delete(trackId);
    return false;
  }
  Promise.resolve(result).catch(error => {
    if (starting.get(trackId) !== token || !isCurrent()) return;
    failed.add(trackId);
    try { onError?.(error); } catch { /* keep the player cleanup reachable */ }
  }).finally(() => {
    if (starting.get(trackId) === token) starting.delete(trackId);
  });
  return true;
}
