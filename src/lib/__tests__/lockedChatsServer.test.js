import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  canConfigureLockedConversation,
  countActiveVerificationAttempts,
  failedPinAttempt,
  isConversationMember,
  isNotFoundError,
  isResetChallengeUsable,
  lockedNotification,
  remainingLockoutMs,
  validPinConfiguration,
} from "../../../base44/shared/lockedChats.ts";

describe("locked chat server policy helpers", () => {
  it("requires explicit conversation membership", () => {
    expect(isConversationMember({ participant_ids: ["user-1"] }, "user-1")).toBe(true);
    expect(isConversationMember({ participant_ids: ["user-2"] }, "user-1")).toBe(false);
    expect(isConversationMember(null, "user-1")).toBe(false);
    expect(canConfigureLockedConversation({ participant_ids: ["user-1"] }, "user-1", true)).toBe(true);
    expect(canConfigureLockedConversation({ participant_ids: ["user-1"] }, "user-1", false)).toBe(false);
    expect(canConfigureLockedConversation({ participant_ids: ["user-2"] }, "user-1", true)).toBe(false);
  });

  it("distinguishes stale records from transient lookup failures", () => {
    expect(isNotFoundError({ response: { status: 404 } })).toBe(true);
    expect(isNotFoundError({ status: 429 })).toBe(false);
    expect(isNotFoundError(new Error("gateway timeout"))).toBe(false);
  });

  it("rejects expired, exhausted, and consumed reset challenges", () => {
    const now = Date.parse("2026-09-10T20:00:00Z");
    expect(isResetChallengeUsable({
      expires_at: "2026-09-10T20:01:00Z",
      attempt_count: 0,
    }, now)).toBe(true);
    expect(isResetChallengeUsable({
      expires_at: "2026-09-10T19:59:00Z",
      attempt_count: 0,
    }, now)).toBe(false);
    expect(isResetChallengeUsable({
      expires_at: "2026-09-10T20:01:00Z",
      attempt_count: 5,
    }, now)).toBe(false);
    expect(isResetChallengeUsable({
      expires_at: "2026-09-10T20:01:00Z",
      attempt_count: 0,
      consumed_at: "2026-09-10T19:58:00Z",
    }, now)).toBe(false);
  });

  it("compares complete verifier strings", () => {
    expect(constantTimeEqual("same-value", "same-value")).toBe(true);
    expect(constantTimeEqual("same-value", "same-valuE")).toBe(false);
    expect(constantTimeEqual("short", "shorter")).toBe(false);
  });

  it("applies exponential PIN lockout after repeated failures", () => {
    expect(failedPinAttempt(3, 1_000)).toEqual({
      failedAttempts: 4,
      lockedUntil: null,
      retryAfterMs: 0,
    });

    const fifth = failedPinAttempt(4, 1_000);
    const sixth = failedPinAttempt(5, 1_000);
    expect(fifth.retryAfterMs).toBe(30_000);
    expect(sixth.retryAfterMs).toBe(60_000);
    expect(remainingLockoutMs(sixth.lockedUntil, 1_000)).toBe(60_000);
  });

  it("counts durable pending reservations inside the throttle window", () => {
    const now = Date.parse("2026-09-10T20:00:00Z");
    expect(countActiveVerificationAttempts([
      { status: "pending", attempted_at: "2026-09-10T19:59:59Z" },
      { status: "failed", attempted_at: "2026-09-10T19:50:01Z" },
      { status: "succeeded", attempted_at: "2026-09-10T19:59:58Z" },
      { status: "failed", attempted_at: "2026-09-10T19:40:00Z" },
    ], now)).toBe(1);
  });

  it("accepts only the supported PBKDF2 verifier shape", () => {
    expect(validPinConfiguration({
      salt: btoa("1234567890123456"),
      verifier: btoa("12345678901234567890123456789012"),
      iterations: 600_000,
    })).toBe(true);
    expect(validPinConfiguration({
      salt: btoa("short"),
      verifier: btoa("12345678901234567890123456789012"),
      iterations: 600_000,
    })).toBe(false);
    expect(validPinConfiguration({
      salt: btoa("1234567890123456"),
      verifier: btoa("12345678901234567890123456789012"),
      iterations: 1,
    })).toBe(false);
  });

  it("creates notification metadata without identity or content", () => {
    const notification = lockedNotification("conversation-1");
    expect(notification).toEqual({
      conversation_id: "conversation-1",
      locked_chat: true,
      actor_id: "",
      actor_name: "Locked chat",
      actor_avatar: "",
      message: "New message in a locked chat.",
      link: "/messages?id=conversation-1",
    });
  });
});
