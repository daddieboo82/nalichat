import { describe, expect, it, vi } from "vitest";
import {
  classifyMessageText,
  enforceModerationResult,
} from "../../../base44/shared/messageModeration.ts";

describe("shared message moderation", () => {
  it("uses the immediate-send policy classifier for scheduled delivery", async () => {
    const InvokeLLM = vi.fn().mockResolvedValue({
      flagged: true,
      category: "bullying",
      severity: "medium",
      explanation: "Targeted harassment",
    });
    await expect(classifyMessageText({
      text: "flag this",
      integrations: { Core: { InvokeLLM } },
    })).resolves.toEqual({
      flagged: true,
      category: "bullying",
      severity: "medium",
      explanation: "Targeted harassment",
    });
  });

  it("increments strikes atomically and records the scheduled source", async () => {
    let violationCount = 1;
    const createViolation = vi.fn();
    const updateUser = vi.fn();
    const dependencies = {
      integrations: { Core: { InvokeLLM: vi.fn() } },
      entities: {
        Violation: { create: createViolation },
        User: {
          updateMany: vi.fn(async () => {
            violationCount += 1;
            return { updated: 1 };
          }),
          get: vi.fn(async () => ({ id: "sender", violation_count: violationCount })),
          update: updateUser,
        },
        Message: { delete: vi.fn() },
      },
    };

    const result = await enforceModerationResult({
      classification: {
        flagged: true,
        category: "bullying",
        severity: "medium",
        explanation: "Targeted harassment",
      },
      text: "flag this",
      user: { id: "sender", display_name: "Sender" },
      conversationId: "conversation",
      scheduledMessageId: "scheduled-1",
      dependencies,
      now: new Date("2026-09-10T20:00:00.000Z"),
    });

    expect(result).toEqual(expect.objectContaining({
      flagged: true,
      action_taken: "timeout",
      violation_count: 2,
    }));
    expect(createViolation).toHaveBeenCalledWith(expect.objectContaining({
      scheduled_message_id: "scheduled-1",
      action_taken: "timeout",
    }));
    expect(updateUser).toHaveBeenCalledWith("sender", {
      timeout_until: "2026-09-12T20:00:00.000Z",
    });
  });
});
