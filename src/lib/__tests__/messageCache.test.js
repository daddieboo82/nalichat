import { describe, it, expect } from "vitest";
import {
  createClientMessageKey,
  createTempId,
  applyQueuedMessage,
  applyDeliveryState,
  applySendSuccess,
  applySendFailure,
  applyRealtimeCreate,
} from "@/lib/messageCache";

const temp = (clientKey, text) => ({
  id: `temp-${clientKey}`,
  _tempId: `temp-${clientKey}`,
  client_message_key: clientKey,
  text,
  type: "text",
  sender_id: "me",
  _optimistic: true,
  _deliveryState: "sending",
});
const legacyTemp = (tempId, text) => ({
  id: tempId,
  _tempId: tempId,
  text,
  type: "text",
  sender_id: "me",
  _optimistic: true,
});
const saved = (id, clientKey, text) => ({
  id,
  client_message_key: clientKey,
  text,
  type: "text",
  sender_id: "me",
});

describe("message identifiers", () => {
  it("generates unique client keys and temp ids", () => {
    const keys = new Set();
    const tempIds = new Set();
    for (let index = 0; index < 1_000; index += 1) {
      keys.add(createClientMessageKey());
      tempIds.add(createTempId());
    }
    expect(keys.size).toBe(1_000);
    expect(tempIds.size).toBe(1_000);
  });
});

describe("queued delivery state", () => {
  it("upserts a restored queue item by client key", () => {
    const first = temp("key-12345", "hello");
    const queued = { ...first, _deliveryState: "queued" };
    const result = applyQueuedMessage([first], queued);
    expect(result).toHaveLength(1);
    expect(result[0]._deliveryState).toBe("queued");
  });

  it("never overwrites a server-confirmed message with a stale queue copy", () => {
    const confirmed = { ...saved("real-1", "key-a123", "hello"), _deliveryState: "sent" };
    const result = applyQueuedMessage([confirmed], temp("key-a123", "hello"));
    expect(result).toEqual([confirmed]);
  });

  it("preserves a failed message and marks it retryable", () => {
    const cache = [temp("key-a123", "first"), temp("key-b123", "second")];
    const result = applySendFailure(cache, "key-a123", "offline");
    expect(result).toHaveLength(2);
    expect(result.find(message => message.client_message_key === "key-a123"))
      .toMatchObject({ _deliveryState: "failed", _retryable: true, _sendError: "offline" });
    expect(result.find(message => message.client_message_key === "key-b123")._deliveryState)
      .toBe("sending");
  });

  it("moves a failed message back to sending without replacing it", () => {
    const failed = applySendFailure([temp("key-a123", "first")], "key-a123");
    const result = applyDeliveryState(failed, "key-a123", "sending", { _retryable: false });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ _deliveryState: "sending", _retryable: false });
  });
});

describe("applySendSuccess", () => {
  it("replaces the keyed optimistic message with the saved message", () => {
    const result = applySendSuccess(
      [temp("key-a123", "hello")],
      saved("real-1", "key-a123", "hello"),
      "key-a123"
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "real-1", _deliveryState: "sent" });
    expect(result[0]._optimistic).toBeUndefined();
  });

  it("keeps other in-flight sends when one resolves", () => {
    const cache = [temp("key-a123", "same"), temp("key-b123", "same")];
    const result = applySendSuccess(
      cache,
      saved("real-a", "key-a123", "same"),
      "key-a123"
    );
    expect(result).toHaveLength(2);
    expect(result.some(message => message.client_message_key === "key-b123" && message._optimistic))
      .toBe(true);
  });

  it("does not duplicate a message already delivered by realtime", () => {
    const cache = [
      temp("key-a123", "hi"),
      { ...saved("real-1", "key-a123", "hi"), _deliveryState: "sent" },
    ];
    const result = applySendSuccess(cache, saved("real-1", "key-a123", "hi"), "key-a123");
    expect(result.filter(message => message.id === "real-1")).toHaveLength(1);
  });
});

describe("applyRealtimeCreate", () => {
  it("reconciles the exact optimistic send by client key", () => {
    const cache = [temp("key-a123", "same"), temp("key-b123", "same")];
    const result = applyRealtimeCreate(
      cache,
      saved("real-a", "key-a123", "same"),
      "real-a"
    );
    expect(result).toHaveLength(2);
    expect(result.some(message => message.client_message_key === "key-b123" && message._optimistic))
      .toBe(true);
    expect(result.some(message => message.id === "real-a" && !message._optimistic)).toBe(true);
  });

  it("is idempotent for replayed IDs and duplicate records with the same client key", () => {
    const once = applyRealtimeCreate(
      [temp("key-a123", "hi")],
      saved("real-1", "key-a123", "hi"),
      "real-1"
    );
    const replayed = applyRealtimeCreate(
      once,
      saved("real-1", "key-a123", "hi"),
      "real-1"
    );
    const racedDuplicate = applyRealtimeCreate(
      replayed,
      saved("real-2", "key-a123", "hi"),
      "real-2"
    );
    expect(racedDuplicate).toHaveLength(1);
    expect(racedDuplicate[0].id).toBe("real-1");
  });

  it("does not guess which keyed message matches a legacy identical-text event", () => {
    const cache = [temp("key-a123", "hi"), temp("key-b123", "hi")];
    const legacyEvent = { id: "legacy-1", text: "hi", type: "text", sender_id: "me" };
    const result = applyRealtimeCreate(cache, legacyEvent, "legacy-1");
    expect(result.filter(message => message._optimistic)).toHaveLength(2);
    expect(result.some(message => message.id === "legacy-1")).toBe(true);
  });

  it("retains one-at-a-time reconciliation for legacy optimistic messages", () => {
    const cache = [legacyTemp("temp-a", "hi"), legacyTemp("temp-b", "hi")];
    const legacyEvent = { id: "legacy-1", text: "hi", type: "text", sender_id: "me" };
    const result = applyRealtimeCreate(cache, legacyEvent, "legacy-1");
    expect(result.filter(message => message._optimistic)).toHaveLength(1);
    expect(result.some(message => message.id === "legacy-1")).toBe(true);
  });

  it("appends messages from other people without touching local sends", () => {
    const cache = [temp("key-a123", "mine")];
    const incoming = { id: "real-9", text: "theirs", type: "text", sender_id: "them" };
    const result = applyRealtimeCreate(cache, incoming, "real-9");
    expect(result).toHaveLength(2);
    expect(result.some(message => message.client_message_key === "key-a123")).toBe(true);
  });
});
