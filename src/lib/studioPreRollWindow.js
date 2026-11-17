// Pre-roll can only use time that exists before the punch-in position.
// At timeline zero there is no prior context, so recording begins directly.
export function studioPreRollWindow(position, requestedSeconds) {
  const start = Number.isFinite(position) ? Math.max(0, position) : 0;
  const requested = Number.isFinite(requestedSeconds) ? Math.max(0, requestedSeconds) : 0;
  const available = Math.min(start, requested);
  return { startTime: start - available, duration: available, enabled: available > 0 };
}
