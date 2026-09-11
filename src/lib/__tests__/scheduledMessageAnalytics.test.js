import { describe, expect, it, vi } from "vitest";
import { trackScheduledMessageEvent } from "@/lib/scheduledMessageAnalytics";

describe("scheduled message analytics", () => {
  it("drops message and recipient data from analytics", () => {
    const originalWindow = globalThis.window;
    const gtag = vi.fn();
    globalThis.window = { gtag };
    trackScheduledMessageEvent("scheduled_message_created", {
      source: "message_composer",
      status: "scheduled",
      lead_minutes: 30,
      text: "private message",
      conversation_id: "private-recipient-context",
      recipient_id: "recipient-1",
    });
    expect(gtag).toHaveBeenCalledWith("event", "scheduled_message_created", {
      source: "message_composer",
      status: "scheduled",
      lead_minutes: 30,
    });
    globalThis.window = originalWindow;
  });
});
