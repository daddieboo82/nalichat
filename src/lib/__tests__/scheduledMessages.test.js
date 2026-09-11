// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("@/api/base44Client", () => ({
  base44: { functions: { invoke: vi.fn() } },
}));

import {
  defaultLocalScheduleTime,
  resolveLocalDateTime,
  validateClientSchedule,
} from "@/lib/scheduledMessages";
import { resolveEntitlements } from "../../../base44/shared/subscription.ts";
import {
  ScheduledMessageError,
  acquireScheduledCreateLease,
  assertConversationMembership,
  cancelScheduledRecord,
  claimScheduledMessage,
  requestsMatch,
  sanitizeScheduledPayload,
  selectFairDueCandidates,
  senderSafetyFailure,
} from "../../../base44/shared/scheduledMessages.ts";

const originalTimezone = process.env.TZ;

beforeAll(() => {
  process.env.TZ = "America/New_York";
});

afterAll(() => {
  process.env.TZ = originalTimezone;
});

describe("scheduled message time conversion", () => {
  it("converts a local wall-clock time to a UTC instant", () => {
    expect(resolveLocalDateTime("2026-07-01T09:30").iso).toBe("2026-07-01T13:30:00.000Z");
  });

  it("rejects a nonexistent DST spring-forward time", () => {
    expect(() => resolveLocalDateTime("2026-03-08T02:30")).toThrow(
      "does not exist",
    );
  });

  it("lets the caller choose either occurrence of an ambiguous fall-back time", () => {
    const earlier = resolveLocalDateTime("2026-11-01T01:30", "earlier");
    const later = resolveLocalDateTime("2026-11-01T01:30", "later");
    expect(earlier.ambiguous).toBe(true);
    expect(earlier.iso).toBe("2026-11-01T05:30:00.000Z");
    expect(later.iso).toBe("2026-11-01T06:30:00.000Z");
  });

  it("enforces future schedule bounds", () => {
    const now = new Date("2026-09-10T20:00:00.000Z");
    expect(() => validateClientSchedule("2026-09-10T20:04:59.000Z", now)).toThrow(
      "at least 5 minutes",
    );
    expect(() => validateClientSchedule("2027-09-11T20:00:01.000Z", now)).toThrow(
      "within the next 365 days",
    );
    expect(defaultLocalScheduleTime(now)).toMatch(/T/);
  });
});

describe("scheduled message policy", () => {
  it("keeps Free immediate chat while gating scheduling to paid tiers", () => {
    const free = resolveEntitlements("free", "active");
    const premium = resolveEntitlements("premium", "active");
    const plus = resolveEntitlements("premium_plus", "active");
    expect(free["chat.core"]).toBe(true);
    expect(free["messages.schedule"]).toBe(false);
    expect(premium["messages.schedule"]).toBe(true);
    expect(plus["messages.schedule"]).toBe(true);
  });

  it("sanitizes text and rejects unsupported message types", () => {
    expect(sanitizeScheduledPayload({ type: "text", text: "  hi\u0000\r\nthere  " }))
      .toEqual({ type: "text", text: "hi\nthere" });
    expect(() => sanitizeScheduledPayload({ type: "image", text: "no" }))
      .toThrow(ScheduledMessageError);
  });

  it("enforces conversation membership without trusting client sender fields", () => {
    expect(() => assertConversationMembership("sender", {
      id: "conversation",
      participant_ids: ["someone-else"],
    })).toThrow("no longer a member");
  });

  it("matches stable client requests and detects conflicting reuse", () => {
    const record = {
      conversation_id: "conversation",
      scheduled_at: "2026-09-11T20:00:00.000Z",
      payload: { type: "text", text: "Hello" },
    };
    expect(requestsMatch(record, "conversation", record.payload, record.scheduled_at)).toBe(true);
    expect(requestsMatch(record, "other", record.payload, record.scheduled_at)).toBe(false);
  });

  it("applies timeout and banned-sender rules, including admin appeals", () => {
    const conversation = { id: "c1", participant_ids: ["sender", "admin"] };
    expect(senderSafetyFailure(
      { id: "sender", timeout_until: "2026-09-11T00:00:00.000Z" },
      conversation,
      [{ id: "admin", role: "admin" }],
      new Date("2026-09-10T00:00:00.000Z"),
    )).toBe("SENDER_TIMED_OUT");
    expect(senderSafetyFailure(
      { id: "sender", is_banned: true },
      conversation,
      [{ id: "admin", role: "admin" }],
    )).toBeNull();
    expect(senderSafetyFailure(
      { id: "sender", is_banned: true },
      { id: "c2", participant_ids: ["sender", "user"] },
      [{ id: "user", role: "artist" }],
    )).toBe("SENDER_BANNED");
  });

  it("claims due work with a compare-and-set update", async () => {
    const record = {
      id: "scheduled-1",
      sender_id: "sender",
      conversation_id: "conversation",
      payload: { type: "text", text: "Hello" },
      scheduled_at: "2026-09-10T19:00:00.000Z",
      dispatch_after: "2026-09-10T19:00:00.000Z",
      status: "processing",
      client_request_key: "schedule_12345678",
      created_at: "2026-09-10T18:00:00.000Z",
      updated_at: "2026-09-10T20:00:00.000Z",
      claim_token: "worker-1",
    };
    const updateMany = vi.fn().mockResolvedValue({ updated: 1 });
    const entity = { updateMany, get: vi.fn().mockResolvedValue(record) };
    await expect(claimScheduledMessage(
      entity,
      { ...record, status: "scheduled" },
      new Date("2026-09-10T20:00:00.000Z"),
      "worker-1",
    )).resolves.toEqual(record);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "scheduled-1",
        status: "scheduled",
        dispatch_after: { $lte: "2026-09-10T20:00:00.000Z" },
      }),
      expect.any(Object),
    );
  });

  it("does not cancel after a dispatcher wins the processing race", async () => {
    const entity = {
      get: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ updated: 0 }),
    };
    await expect(cancelScheduledRecord(
      entity,
      "scheduled-1",
      "sender",
      new Date("2026-09-10T20:00:00.000Z"),
    )).resolves.toBe(false);
  });

  it("serializes concurrent create requests with an atomic user lease", async () => {
    const updateMany = vi.fn()
      .mockResolvedValueOnce({ updated: 1 })
      .mockResolvedValueOnce({ updated: 0 });
    const entity = { updateMany };
    await expect(acquireScheduledCreateLease(
      entity,
      "sender",
      "worker-1",
      new Date("2026-09-10T20:00:00.000Z"),
    )).resolves.toBe(true);
    await expect(acquireScheduledCreateLease(
      entity,
      "sender",
      "worker-2",
      new Date("2026-09-10T20:00:00.000Z"),
    )).resolves.toBe(false);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sender", $or: expect.any(Array) }),
      expect.objectContaining({ $set: expect.objectContaining({
        scheduled_message_create_claim_token: "worker-1",
      }) }),
    );
  });

  it("fairly limits due work from any one sender", () => {
    const candidates = [
      ...Array.from({ length: 10 }, (_, index) => ({ sender_id: "sender-a", id: `a-${index}` })),
      ...Array.from({ length: 5 }, (_, index) => ({ sender_id: "sender-b", id: `b-${index}` })),
    ];
    const selected = selectFairDueCandidates(candidates, 10, 5);
    expect(selected).toHaveLength(10);
    expect(selected.filter((item) => item.sender_id === "sender-a")).toHaveLength(5);
    expect(selected.filter((item) => item.sender_id === "sender-b")).toHaveLength(5);
  });
});
