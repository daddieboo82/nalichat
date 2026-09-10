// Message cache reducers, extracted from Messages.jsx so the optimistic-update
// rules are unit-testable rather than buried in mutation callbacks.
//
// The bug these encode: the original code filtered EVERY entry flagged
// `_optimistic`, so if a user sent B while A was still in flight, A resolving
// erased B's bubble from the UI until B resolved. The rollback path was worse -
// it restored a pre-send snapshot, discarding concurrent sends outright.

/** Unique per send. Date.now() alone collides when two sends land in the same ms. */
export function createTempId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Swap this send's optimistic bubble for the saved message, leaving others alone. */
export function applySendSuccess(messages = [], saved, tempId) {
  const withoutTemp = messages.filter(m => m._tempId !== tempId);
  if (withoutTemp.some(m => m.id === saved.id)) return withoutTemp;
  return [...withoutTemp, saved];
}

/** Remove only the failed send's bubble. */
export function applySendFailure(messages = [], tempId) {
  if (!tempId) return messages;
  return messages.filter(m => m._tempId !== tempId);
}

/**
 * Apply a realtime create event. Retires at most ONE matching optimistic temp,
 * rather than every temp from that sender.
 */
export function applyRealtimeCreate(messages = [], data, eventId) {
  const idx = messages.findIndex(m =>
    m._optimistic &&
    m.sender_id === data?.sender_id &&
    (m.text || '') === (data?.text || '') &&
    (m.type || 'text') === (data?.type || 'text')
  );
  const withoutTemp = idx >= 0 ? messages.filter((_, i) => i !== idx) : messages;
  if (withoutTemp.some(m => m.id === eventId)) return withoutTemp;
  return [...withoutTemp, data];
}
