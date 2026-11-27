// The Studio transport must never cut a long recording at a fixed 100-second
// marker. Legacy empty/short projects retain the 100-second preview loop.
export function studioProjectEndSeconds(tracks = [], minimumSeconds = 100) {
  let end = minimumSeconds;
  if (!Array.isArray(tracks)) return end;
  for (const track of tracks) {
    const start = Number(track?.startTime ?? 0);
    const duration = Number(track?.duration ?? 0);
    if (!Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration <= 0) continue;
    const candidate = start + duration;
    if (Number.isFinite(candidate)) end = Math.max(end, candidate);
  }
  return end;
}

export function nextStudioTransportPosition({
  nextTime, recording = false, looping = false,
  selectionStart = null, selectionEnd = null, tracks = [],
} = {}) {
  const next = Number.isFinite(nextTime) ? Math.max(0, nextTime) : 0;
  const selectionValid = looping && Number.isFinite(selectionStart) && Number.isFinite(selectionEnd) &&
    selectionStart >= 0 && selectionEnd > selectionStart;
  if (selectionValid && next >= selectionEnd) {
    return { time: selectionStart, wrapped: true };
  }
  // Never rewind an active capture in the middle of a long vocal take.
  if (recording) return { time: next, wrapped: false };
  const end = studioProjectEndSeconds(tracks);
  if (!selectionValid && next > end) return { time: 0, wrapped: true };
  return { time: next, wrapped: false };
}
