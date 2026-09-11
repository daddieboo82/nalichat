/** Stable for a send and every retry of that send. */
export function createClientMessageKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Kept for callers and tests that still refer to optimistic IDs. */
export function createTempId() {
  return `temp-${createClientMessageKey()}`;
}

function matchesClientMessage(message, clientMessageKey, tempId) {
  if (clientMessageKey && message.client_message_key === clientMessageKey) return true;
  return !!tempId && message._tempId === tempId;
}

/** Insert or update a locally queued message without duplicating it. */
export function applyQueuedMessage(messages = [], queued) {
  const key = queued?.client_message_key;
  const index = messages.findIndex(message =>
    matchesClientMessage(message, key, queued?._tempId)
  );
  if (index < 0) return [...messages, queued];
  if (!messages[index]._optimistic) return messages;
  return messages.map((message, current) =>
    current === index ? { ...message, ...queued } : message
  );
}

/** Change a local message's delivery state while preserving its retry payload. */
export function applyDeliveryState(messages = [], clientMessageKey, deliveryState, details = {}) {
  if (!clientMessageKey) return messages;
  return messages.map(message =>
    message.client_message_key === clientMessageKey
      ? { ...message, ...details, _deliveryState: deliveryState }
      : message
  );
}

/** Swap this send's optimistic bubble for the saved message, leaving others alone. */
export function applySendSuccess(messages = [], saved, clientMessageKey, tempId) {
  const key = clientMessageKey || saved?.client_message_key;
  const withoutLocal = messages.filter(message =>
    !matchesClientMessage(message, key, tempId) &&
    message.id !== saved?.id
  );
  return [...withoutLocal, { ...saved, _deliveryState: "sent" }];
}

/** Preserve a failed send so the user can retry it with the same client key. */
export function applySendFailure(messages = [], clientMessageKey, errorMessage, retryable = true) {
  if (!clientMessageKey) return messages;
  return applyDeliveryState(messages, clientMessageKey, "failed", {
    _optimistic: true,
    _retryable: retryable,
    _sendError: errorMessage || "Message could not be sent.",
  });
}

/** Remove a locally pending message after a non-retryable rejection. */
export function removeClientMessage(messages = [], clientMessageKey) {
  if (!clientMessageKey) return messages;
  return messages.filter(message => message.client_message_key !== clientMessageKey);
}

/**
 * Apply a realtime create event. Keyed events reconcile only by their stable
 * client key. Legacy events retain the old one-at-a-time heuristic, but only
 * against legacy optimistic messages, so identical keyed sends cannot collide.
 */
export function applyRealtimeCreate(messages = [], data, eventId) {
  const incoming = { ...data, id: data?.id || eventId, _deliveryState: "sent" };
  const clientMessageKey = incoming.client_message_key;

  if (clientMessageKey) {
    const existingSaved = messages.find(message =>
      message.client_message_key === clientMessageKey && !message._optimistic
    );
    if (existingSaved) return messages;

    const withoutMatchingLocal = messages.filter(message =>
      message.client_message_key !== clientMessageKey &&
      message.id !== incoming.id
    );
    return [...withoutMatchingLocal, incoming];
  }

  if (messages.some(message => message.id === incoming.id)) return messages;

  const legacyIndex = messages.findIndex(message =>
    message._optimistic &&
    !message.client_message_key &&
    message.sender_id === incoming.sender_id &&
    (message.text || "") === (incoming.text || "") &&
    (message.type || "text") === (incoming.type || "text")
  );
  const withoutLegacyTemp = legacyIndex >= 0
    ? messages.filter((_, index) => index !== legacyIndex)
    : messages;
  return [...withoutLegacyTemp, incoming];
}
