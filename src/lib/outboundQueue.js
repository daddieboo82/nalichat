const STORAGE_KEY = "nalichat:outbound-messages:v1";
const MAX_BACKOFF_MS = 30_000;
const BASE_BACKOFF_MS = 1_000;
const VALID_TYPES = new Set(["text", "file", "audio", "image", "video", "session"]);
const PAYLOAD_FIELDS = [
  "text",
  "type",
  "file_url",
  "file_name",
  "file_size",
  "file_type",
  "duration",
  "reply_to_id",
  "reply_to_text",
  "reply_to_sender",
  "thread_id",
];

let activeFlush = null;
let rerunRequested = false;

function browserStorage() {
  return typeof window === "undefined" ? null : window.localStorage;
}

function cleanString(value, maxLength = 10_000) {
  return typeof value === "string" ? value.slice(0, maxLength) : undefined;
}

export function sanitizeOutboundPayload(payload = {}) {
  const sanitized = {};
  for (const field of PAYLOAD_FIELDS) {
    const value = payload[field];
    if (value === undefined || value === null) continue;
    if (field === "file_size" || field === "duration") {
      if (Number.isFinite(value) && value >= 0) sanitized[field] = value;
      continue;
    }
    sanitized[field] = cleanString(value, field === "text" ? 10_000 : 2_000);
  }
  sanitized.type = VALID_TYPES.has(sanitized.type) ? sanitized.type : "text";
  sanitized.text = sanitized.text || "";
  return sanitized;
}

export function createOutboundEntry({
  clientMessageKey,
  conversationId,
  payload,
  sender,
  now = Date.now(),
}) {
  if (!clientMessageKey || !conversationId || !sender?.id) {
    throw new Error("A client key, conversation, and sender are required.");
  }
  return {
    clientMessageKey,
    conversationId,
    payload: sanitizeOutboundPayload(payload),
    sender: {
      id: cleanString(sender.id, 200),
      name: cleanString(sender.name, 200) || "",
      avatar: cleanString(sender.avatar, 2_000) || "",
    },
    createdAt: new Date(now).toISOString(),
    state: "queued",
    attemptCount: 0,
    nextAttemptAt: 0,
    lastError: null,
  };
}

function isValidEntry(entry) {
  return !!(
    entry &&
    typeof entry.clientMessageKey === "string" &&
    typeof entry.conversationId === "string" &&
    entry.sender?.id &&
    entry.payload
  );
}

export function readOutboundQueue(storage = browserStorage()) {
  if (!storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry).map(entry => ({
      ...entry,
      payload: sanitizeOutboundPayload(entry.payload),
      state: entry.state,
      attemptCount: Number.isFinite(entry.attemptCount) ? entry.attemptCount : 0,
      nextAttemptAt: Number.isFinite(entry.nextAttemptAt) ? entry.nextAttemptAt : 0,
    }));
  } catch (error) {
    console.error("Unable to read the outbound message queue:", error);
    return [];
  }
}

export function writeOutboundQueue(entries, storage = browserStorage()) {
  if (!storage) throw new Error("Persistent browser storage is unavailable.");
  storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return entries;
}

export function purgeOutboundQueueForUser(userId, storage = browserStorage()) {
  if (!storage || !userId) return [];
  const retained = readOutboundQueue(storage).filter(entry => entry.sender?.id !== userId);
  writeOutboundQueue(retained, storage);
  return retained;
}

export function enqueueOutbound(entry, storage = browserStorage()) {
  const entries = readOutboundQueue(storage);
  const existingIndex = entries.findIndex(item =>
    item.clientMessageKey === entry.clientMessageKey &&
    item.sender.id === entry.sender.id
  );
  if (existingIndex >= 0) entries[existingIndex] = { ...entries[existingIndex], ...entry };
  else entries.push(entry);
  return writeOutboundQueue(entries, storage);
}

export function markOutboundForRetry(clientMessageKey, storage = browserStorage()) {
  const entries = readOutboundQueue(storage);
  const next = entries.map(entry =>
    entry.clientMessageKey === clientMessageKey
      ? { ...entry, state: "queued", nextAttemptAt: 0, lastError: null }
      : entry
  );
  writeOutboundQueue(next, storage);
  return next.find(entry => entry.clientMessageKey === clientMessageKey) || null;
}

export function getBackoffDelay(attemptCount) {
  return Math.min(
    MAX_BACKOFF_MS,
    BASE_BACKOFF_MS * (2 ** Math.max(0, attemptCount - 1))
  );
}

export function getNextRetryAt(storage = browserStorage(), userId) {
  const retryTimes = readOutboundQueue(storage)
    .filter(entry => (!userId || entry.sender.id === userId) && entry.nextAttemptAt > 0)
    .map(entry => entry.nextAttemptAt);
  return retryTimes.length ? Math.min(...retryTimes) : null;
}

export function queueEntryToMessage(entry) {
  const deliveryState = entry.state === "failed"
    ? "failed"
    : entry.state === "sending"
      ? "sending"
      : "queued";
  return {
    id: `temp-${entry.clientMessageKey}`,
    _tempId: `temp-${entry.clientMessageKey}`,
    client_message_key: entry.clientMessageKey,
    conversation_id: entry.conversationId,
    sender_id: entry.sender.id,
    sender_name: entry.sender.name,
    sender_avatar: entry.sender.avatar,
    created_date: entry.createdAt,
    ...entry.payload,
    _optimistic: true,
    _retryable: entry.state === "failed",
    _deliveryState: deliveryState,
    _sendError: entry.lastError,
  };
}

function replaceEntry(entries, changed) {
  return entries.map(entry =>
    entry.clientMessageKey === changed.clientMessageKey &&
    entry.sender.id === changed.sender.id
      ? changed
      : entry
  );
}

function removeEntry(entries, removed) {
  return entries.filter(entry =>
    entry.clientMessageKey !== removed.clientMessageKey ||
    entry.sender.id !== removed.sender.id
  );
}

function getErrorStatus(error) {
  return error?.status || error?.response?.status || error?.response?.data?.status;
}

function getErrorCode(error) {
  return error?.code || error?.data?.code || error?.response?.data?.code;
}

function isPermanentServerRejection(error) {
  const status = getErrorStatus(error);
  return [400, 401, 403, 404, 405, 410, 413, 422].includes(status);
}

/**
 * Flushes due entries serially. The single-flight guard prevents reconnect,
 * retry, and timer triggers from sending the same queued item concurrently.
 */
export function flushOutboundQueue({
  storage = browserStorage(),
  send,
  isOnline = () => typeof navigator === "undefined" || navigator.onLine,
  now = () => Date.now(),
  userId,
  onSending,
  onSent,
  onRejected,
  onFailed,
}) {
  if (activeFlush) {
    rerunRequested = true;
    return activeFlush;
  }

  activeFlush = (async () => {
    const outcomes = [];
    do {
      rerunRequested = false;
      if (!isOnline()) break;

      const snapshot = readOutboundQueue(storage);
      const due = snapshot.filter(entry =>
        (!userId || entry.sender.id === userId) &&
        entry.nextAttemptAt <= now()
      );

      for (const queued of due) {
        if (!isOnline()) break;
        let entries = readOutboundQueue(storage);
        const current = entries.find(entry =>
          entry.clientMessageKey === queued.clientMessageKey &&
          entry.sender.id === queued.sender.id
        );
        if (!current || current.nextAttemptAt > now()) continue;

        const sending = { ...current, state: "sending" };
        writeOutboundQueue(replaceEntry(entries, sending), storage);
        onSending?.(sending);

        try {
          const result = await send(sending);
          entries = readOutboundQueue(storage);
          if (result?.rejection?.type === "moderation") {
            writeOutboundQueue(removeEntry(entries, sending), storage);
            onRejected?.(sending, result.rejection);
            outcomes.push({ key: sending.clientMessageKey, status: "rejected" });
            continue;
          }
          if (!result?.message) throw new Error("The message service returned no message.");

          writeOutboundQueue(removeEntry(entries, sending), storage);
          onSent?.(sending, result.message);
          outcomes.push({ key: sending.clientMessageKey, status: "sent" });
        } catch (error) {
          if (isPermanentServerRejection(error)) {
            entries = readOutboundQueue(storage);
            writeOutboundQueue(removeEntry(entries, sending), storage);
            onRejected?.(sending, {
              type: "server",
              code: getErrorCode(error),
              message: error?.response?.data?.error || error?.data?.error || error?.message,
            });
            outcomes.push({ key: sending.clientMessageKey, status: "rejected" });
            continue;
          }
          const attemptCount = sending.attemptCount + 1;
          const failed = {
            ...sending,
            state: "failed",
            attemptCount,
            nextAttemptAt: now() + getBackoffDelay(attemptCount),
            lastError: error?.message || "Message could not be sent.",
          };
          entries = readOutboundQueue(storage);
          writeOutboundQueue(replaceEntry(entries, failed), storage);
          onFailed?.(failed, error);
          outcomes.push({ key: sending.clientMessageKey, status: "failed" });
        }
      }
    } while (rerunRequested);
    return outcomes;
  })().finally(() => {
    activeFlush = null;
  });

  return activeFlush;
}

export const OUTBOUND_QUEUE_STORAGE_KEY = STORAGE_KEY;
