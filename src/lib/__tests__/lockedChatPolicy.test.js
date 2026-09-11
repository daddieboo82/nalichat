import { describe, expect, it } from "vitest";
import {
  countVisibleUnreadConversations,
  partitionUserConversations,
  redactLockedChatNotification,
  resolveRequestedConversation,
} from "@/lib/lockedChatPolicy";

const conversations = [
  { id: "visible", participant_ids: ["me", "other"], last_message_at: "2026-09-10T20:00:00Z" },
  { id: "locked", participant_ids: ["me", "other"], last_message_at: "2026-09-10T20:01:00Z" },
  { id: "not-mine", participant_ids: ["other"], last_message_at: "2026-09-10T20:02:00Z" },
];

describe("locked chat discovery policy", () => {
  it("keeps locked and non-member chats out of the normal list", () => {
    const result = partitionUserConversations(conversations, "me", ["locked"]);
    expect(result.visible.map(({ id }) => id)).toEqual(["visible"]);
    expect(result.locked.map(({ id }) => id)).toEqual(["locked"]);
  });

  it("excludes locked chats from unread summaries", () => {
    expect(countVisibleUnreadConversations(
      conversations,
      "me",
      ["locked"],
      () => 0,
    )).toBe(1);
  });

  it("removes identity, text, and avatar from locked-chat notifications", () => {
    const notification = redactLockedChatNotification({
      type: "message",
      actor_id: "user-alice",
      actor_name: "Alice",
      actor_avatar: "https://example.com/alice.png",
      message: "secret preview",
      link: "/messages?id=locked",
    }, ["locked"]);

    expect(notification).toMatchObject({
      actor_name: "Locked chat",
      actor_id: "",
      actor_avatar: "",
      message: "New message in a locked chat.",
    });
    expect(JSON.stringify(notification)).not.toContain("secret preview");
    expect(JSON.stringify(notification)).not.toContain("Alice");
    expect(JSON.stringify(notification)).not.toContain("user-alice");
  });

  it("redacts all message notifications while privacy state is unavailable", () => {
    const notification = redactLockedChatNotification({
      type: "message",
      actor_name: "Alice",
      message: "preview",
      link: "/messages?id=visible",
    }, [], true);

    expect(notification.message).toBe("New message in a locked chat.");
    expect(notification.actor_name).toBe("Locked chat");
  });

  it("guards locked direct links until the local vault is unlocked", () => {
    expect(resolveRequestedConversation(
      conversations.filter((conversation) => conversation.participant_ids.includes("me")),
      "locked",
      ["locked"],
      false,
    ).status).toBe("locked");
    expect(resolveRequestedConversation(
      conversations.filter((conversation) => conversation.participant_ids.includes("me")),
      "locked",
      ["locked"],
      true,
    ).status).toBe("allowed");
    expect(resolveRequestedConversation(conversations.slice(0, 2), "not-mine", [], true).status).toBe("missing");
  });
});
