import { describe, expect, it, vi } from "vitest";
import {
  OUTBOUND_QUEUE_STORAGE_KEY,
  createOutboundEntry,
  enqueueOutbound,
  flushOutboundQueue,
  getBackoffDelay,
  markOutboundForRetry,
  queueEntryToMessage,
  readOutboundQueue,
  sanitizeOutboundPayload,
} from "@/lib/outboundQueue";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: vi.fn(key => values.get(key) || null),
    setItem: vi.fn((key, value) => values.set(key, value)),
    removeItem: vi.fn(key => values.delete(key)),
  };
}

function entry(overrides = {}) {
  return createOutboundEntry({
    clientMessageKey: "client-key-123",
    conversationId: "conversation-1",
    payload: { text: "hello", type: "text" },
    sender: { id: "user-1", name: "Nali User", avatar: "https://example.com/me.png" },
    now: 1_000,
    ...overrides,
  });
}

describe("outbound queue serialization", () => {
  it("persists safe payload and attachment metadata across reloads", () => {
    const storage = memoryStorage();
    const queued = entry({
      payload: {
        text: "track",
        type: "audio",
        file_url: "https://uploads.example/track.mp3",
        file_name: "track.mp3",
        file_size: 42,
        file_type: "audio/mpeg",
        rawBlob: { secret: true },
      },
    });
    enqueueOutbound(queued, storage);

    const restored = readOutboundQueue(storage);
    expect(restored).toHaveLength(1);
    expect(restored[0].payload).toEqual({
      text: "track",
      type: "audio",
      file_url: "https://uploads.example/track.mp3",
      file_name: "track.mp3",
      file_size: 42,
      file_type: "audio/mpeg",
    });
    expect(storage.setItem).toHaveBeenCalledWith(
      OUTBOUND_QUEUE_STORAGE_KEY,
      expect.any(String)
    );
    expect(queueEntryToMessage(restored[0])).toMatchObject({
      client_message_key: "client-key-123",
      _deliveryState: "queued",
      _optimistic: true,
    });
  });

  it("restores an active send with an accurate sending state", () => {
    expect(queueEntryToMessage({ ...entry(), state: "sending" }))
      .toMatchObject({ _deliveryState: "sending", _retryable: false });
  });

  it("drops unsupported payload fields and normalizes message types", () => {
    expect(sanitizeOutboundPayload({ text: "hello", type: "unknown", token: "secret" }))
      .toEqual({ text: "hello", type: "text" });
  });
});

describe("outbound queue flushing", () => {
  it("keeps offline messages queued without calling the transport", async () => {
    const storage = memoryStorage();
    enqueueOutbound(entry(), storage);
    const send = vi.fn();

    await flushOutboundQueue({ storage, send, isOnline: () => false, userId: "user-1" });

    expect(send).not.toHaveBeenCalled();
    expect(readOutboundQueue(storage)[0].state).toBe("queued");
  });

  it("flushes a queued message and removes it after server confirmation", async () => {
    const storage = memoryStorage();
    enqueueOutbound(entry(), storage);
    const onSent = vi.fn();
    const send = vi.fn().mockResolvedValue({
      message: { id: "saved-1", client_message_key: "client-key-123" },
    });

    const outcomes = await flushOutboundQueue({
      storage,
      send,
      isOnline: () => true,
      userId: "user-1",
      onSent,
    });

    expect(outcomes).toEqual([{ key: "client-key-123", status: "sent" }]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(onSent).toHaveBeenCalledTimes(1);
    expect(readOutboundQueue(storage)).toEqual([]);
  });

  it("preserves transport failures for one-tap retry with the same key", async () => {
    const storage = memoryStorage();
    enqueueOutbound(entry(), storage);
    const now = vi.fn(() => 10_000);

    await flushOutboundQueue({
      storage,
      send: vi.fn().mockRejectedValue(new Error("network down")),
      isOnline: () => true,
      now,
      userId: "user-1",
    });

    const failed = readOutboundQueue(storage)[0];
    expect(failed).toMatchObject({
      clientMessageKey: "client-key-123",
      state: "failed",
      attemptCount: 1,
      nextAttemptAt: 11_000,
      lastError: "network down",
    });

    const retried = markOutboundForRetry("client-key-123", storage);
    expect(retried).toMatchObject({
      clientMessageKey: "client-key-123",
      state: "queued",
      nextAttemptAt: 0,
    });
  });

  it("removes moderation rejections instead of making them retryable", async () => {
    const storage = memoryStorage();
    enqueueOutbound(entry(), storage);
    const onRejected = vi.fn();

    await flushOutboundQueue({
      storage,
      send: vi.fn().mockResolvedValue({
        rejection: { type: "moderation", category: "bullying" },
      }),
      isOnline: () => true,
      userId: "user-1",
      onRejected,
    });

    expect(readOutboundQueue(storage)).toEqual([]);
    expect(onRejected).toHaveBeenCalledWith(
      expect.objectContaining({ clientMessageKey: "client-key-123" }),
      expect.objectContaining({ type: "moderation" })
    );
  });

  it("backs off rather than discarding a transient authentication failure", async () => {
    const storage = memoryStorage();
    enqueueOutbound(entry(), storage);
    const authError = Object.assign(new Error("session expired"), { status: 401 });

    await flushOutboundQueue({
      storage,
      send: vi.fn().mockRejectedValue(authError),
      isOnline: () => true,
      now: () => 5_000,
      userId: "user-1",
    });

    expect(readOutboundQueue(storage)[0]).toMatchObject({
      state: "failed",
      attemptCount: 1,
      nextAttemptAt: 6_000,
    });
  });

  it("uses one active flush when reconnect and retry fire together", async () => {
    const storage = memoryStorage();
    enqueueOutbound(entry(), storage);
    let release;
    const send = vi.fn(() => new Promise(resolve => {
      release = resolve;
    }));
    const options = { storage, send, isOnline: () => true, userId: "user-1" };

    const reconnectFlush = flushOutboundQueue(options);
    const retryFlush = flushOutboundQueue(options);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    release({ message: { id: "saved-1", client_message_key: "client-key-123" } });
    await Promise.all([reconnectFlush, retryFlush]);

    expect(send).toHaveBeenCalledTimes(1);
    expect(readOutboundQueue(storage)).toEqual([]);
  });
});

describe("retry backoff", () => {
  it("grows exponentially and caps at thirty seconds", () => {
    expect(getBackoffDelay(1)).toBe(1_000);
    expect(getBackoffDelay(2)).toBe(2_000);
    expect(getBackoffDelay(6)).toBe(30_000);
    expect(getBackoffDelay(20)).toBe(30_000);
  });
});
