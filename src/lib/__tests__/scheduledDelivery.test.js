import { describe, expect, it, vi } from "vitest";
import {
  deliverClaimedScheduledMessage,
  releaseClaimForRetry,
} from "../../../base44/shared/scheduledDelivery.ts";

const now = new Date("2026-09-10T20:00:00.000Z");

function createHarness({
  existingMessage = null,
  entitled = true,
  moderationFlagged = false,
  conversation = { id: "conversation-1", participant_ids: ["sender-1", "recipient-1"] },
} = {}) {
  const messages = existingMessage ? [existingMessage] : [];
  const transitions = [];
  const entities = {
    ScheduledMessage: {
      get: vi.fn(),
      updateMany: vi.fn(async (_query, update) => {
        transitions.push(update.$set);
        return { updated: 1 };
      }),
    },
    Subscription: { filter: vi.fn() },
    Conversation: {
      get: vi.fn(async () => {
        if (!conversation) {
          throw Object.assign(new Error("not found"), { status: 404 });
        }
        return conversation;
      }),
      update: vi.fn(async (_id, patch) => ({ ...conversation, ...patch })),
      updateMany: vi.fn(async () => ({ updated: 1 })),
    },
    User: {
      get: vi.fn(async (id) => ({
        id,
        display_name: id === "sender-1" ? "Sender" : "Recipient",
        role: "artist",
        is_online: false,
      })),
      update: vi.fn(),
      updateMany: vi.fn(async () => ({ updated: 1 })),
    },
    Message: {
      filter: vi.fn(async () => [...messages]),
      create: vi.fn(async (payload) => {
        const message = {
          id: "message-1",
          created_date: now.toISOString(),
          ...payload,
        };
        messages.push(message);
        return message;
      }),
      delete: vi.fn(),
    },
    Violation: { create: vi.fn() },
  };
  return {
    dependencies: {
      entities,
      integrations: { Core: { InvokeLLM: vi.fn() } },
      resolveAccess: vi.fn(async () => ({
        entitlements: { "messages.schedule": entitled },
      })),
      classify: vi.fn(async () => ({
        flagged: moderationFlagged,
        category: moderationFlagged ? "bullying" : undefined,
      })),
      enforceModeration: vi.fn(async ({ classification }) => classification),
      clock: () => now,
    },
    entities,
    transitions,
  };
}

function claimedRecord(overrides = {}) {
  return {
    id: "scheduled-1",
    sender_id: "sender-1",
    conversation_id: "conversation-1",
    payload: { type: "text", text: "Send while I am offline" },
    scheduled_at: "2026-09-10T20:00:00.000Z",
    dispatch_after: "2026-09-10T20:00:00.000Z",
    status: "processing",
    client_request_key: "schedule_12345678",
    created_at: "2026-09-10T19:00:00.000Z",
    updated_at: "2026-09-10T20:00:00.000Z",
    claim_token: "worker-1",
    attempt_count: 1,
    ...overrides,
  };
}

describe("scheduled delivery", () => {
  it("delivers through the server when the sender is offline", async () => {
    const harness = createHarness();
    const result = await deliverClaimedScheduledMessage({
      dependencies: harness.dependencies,
      record: claimedRecord(),
      claimToken: "worker-1",
      now,
    });
    expect(result.outcome).toBe("sent");
    expect(harness.entities.Message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        sender_id: "sender-1",
        scheduled_message_id: "scheduled-1",
      }),
    );
    expect(harness.transitions.find((transition) => transition.status === "sent")).toEqual(expect.objectContaining({
      status: "sent",
      resulting_message_id: "message-1",
      preview_pending: true,
    }));
  });

  it("reconciles an existing delivery instead of creating a retry duplicate", async () => {
    const harness = createHarness({
      existingMessage: {
        id: "message-existing",
        created_date: "2026-09-10T20:00:00.000Z",
      },
    });
    const result = await deliverClaimedScheduledMessage({
      dependencies: harness.dependencies,
      record: claimedRecord({ attempt_count: 2 }),
      claimToken: "worker-1",
      now,
    });
    expect(result).toEqual({
      id: "scheduled-1",
      outcome: "sent",
      message_id: "message-existing",
    });
    expect(harness.entities.Message.create).not.toHaveBeenCalled();
    expect(harness.dependencies.classify).not.toHaveBeenCalled();
  });

  it("records an existing delivery as sent even if its conversation was deleted", async () => {
    const harness = createHarness({
      conversation: null,
      existingMessage: {
        id: "message-existing",
        created_date: "2026-09-10T20:00:00.000Z",
      },
    });
    const result = await deliverClaimedScheduledMessage({
      dependencies: harness.dependencies,
      record: claimedRecord({ attempt_count: 5 }),
      claimToken: "worker-1",
      now,
    });
    expect(result.outcome).toBe("sent");
    expect(harness.transitions.some((transition) => transition.status === "failed")).toBe(false);
  });

  it("fails explicitly after entitlement is revoked at delivery", async () => {
    const harness = createHarness({ entitled: false });
    const result = await deliverClaimedScheduledMessage({
      dependencies: harness.dependencies,
      record: claimedRecord(),
      claimToken: "worker-1",
      now,
    });
    expect(result).toEqual({
      id: "scheduled-1",
      outcome: "failed",
      code: "ENTITLEMENT_REVOKED",
    });
    expect(harness.entities.Message.create).not.toHaveBeenCalled();
  });

  it("moderates at delivery and never creates rejected content", async () => {
    const harness = createHarness({ moderationFlagged: true });
    const result = await deliverClaimedScheduledMessage({
      dependencies: harness.dependencies,
      record: claimedRecord(),
      claimToken: "worker-1",
      now,
    });
    expect(result.code).toBe("MODERATION_REJECTED");
    expect(harness.dependencies.classify).toHaveBeenCalledOnce();
    expect(harness.dependencies.enforceModeration).toHaveBeenCalledOnce();
    const failedTransitionOrder = harness.entities.ScheduledMessage.updateMany.mock
      .invocationCallOrder.find((_, index) => (
        harness.entities.ScheduledMessage.updateMany.mock.calls[index][1].$set.status === "failed"
      ));
    expect(failedTransitionOrder).toBeLessThan(
      harness.dependencies.enforceModeration.mock.invocationCallOrder[0],
    );
    expect(harness.entities.Message.create).not.toHaveBeenCalled();
  });

  it("fails safely when the conversation was deleted", async () => {
    const harness = createHarness({ conversation: null });
    const result = await deliverClaimedScheduledMessage({
      dependencies: harness.dependencies,
      record: claimedRecord(),
      claimToken: "worker-1",
      now,
    });
    expect(result.code).toBe("CONVERSATION_UNAVAILABLE");
  });

  it("retries transient conversation reads instead of marking them deleted", async () => {
    const harness = createHarness();
    harness.entities.Conversation.get.mockRejectedValueOnce(
      Object.assign(new Error("service unavailable"), { status: 503 }),
    );
    await expect(deliverClaimedScheduledMessage({
      dependencies: harness.dependencies,
      record: claimedRecord(),
      claimToken: "worker-1",
      now,
    })).rejects.toThrow("service unavailable");
    expect(harness.transitions).toEqual([]);
  });

  it("updates the preview only when no newer message already won", async () => {
    const harness = createHarness();
    await deliverClaimedScheduledMessage({
      dependencies: harness.dependencies,
      record: claimedRecord(),
      claimToken: "worker-1",
      now,
    });
    expect(harness.entities.Conversation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "conversation-1",
        $or: expect.arrayContaining([
          { last_message_at: { $lte: "2026-09-10T20:00:00.000Z" } },
        ]),
      }),
      expect.any(Object),
    );
  });

  it("keeps a delivered schedule sent when preview repair is transiently unavailable", async () => {
    const harness = createHarness();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    harness.entities.Conversation.updateMany.mockRejectedValueOnce(
      new Error("preview unavailable"),
    );
    const result = await deliverClaimedScheduledMessage({
      dependencies: harness.dependencies,
      record: claimedRecord(),
      claimToken: "worker-1",
      now,
    });
    expect(result.outcome).toBe("sent");
    expect(harness.transitions.find((transition) => transition.status === "sent"))
      .toEqual(expect.objectContaining({ preview_pending: true }));
    expect(harness.transitions.some((transition) => transition.status === "failed")).toBe(false);
    consoleError.mockRestore();
  });

  it("backs off retryable failures and eventually stops retrying", async () => {
    const harness = createHarness();
    await expect(releaseClaimForRetry({
      entity: harness.entities.ScheduledMessage,
      record: claimedRecord({ attempt_count: 2 }),
      claimToken: "worker-1",
      now,
    })).resolves.toEqual({ id: "scheduled-1", outcome: "retrying" });
    expect(harness.transitions.at(-1).dispatch_after).toBe("2026-09-10T20:02:00.000Z");

    await expect(releaseClaimForRetry({
      entity: harness.entities.ScheduledMessage,
      record: claimedRecord({ attempt_count: 5 }),
      claimToken: "worker-1",
      now,
    })).resolves.toEqual({
      id: "scheduled-1",
      outcome: "failed",
      code: "DELIVERY_RETRY_EXHAUSTED",
    });

    await expect(releaseClaimForRetry({
      entity: harness.entities.ScheduledMessage,
      record: claimedRecord({ attempt_count: 5 }),
      claimToken: "worker-1",
      now,
      allowExhaustion: false,
    })).resolves.toEqual({ id: "scheduled-1", outcome: "retrying" });
  });
});
