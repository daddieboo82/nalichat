import { describe, expect, it } from "vitest";
import {
  cancelFollowUpReminder,
  createFollowUpReminder,
  FollowUpReminderError,
  MAX_REMINDER_DELAY_MS,
  messageIdFromEntityEvent,
  processDueFollowUpReminders,
  resolveFollowUpRemindersForMessage,
} from "../../../base44/shared/followUpReminders.ts";
import { resolveEntitlements } from "../../../base44/shared/subscription.ts";

function matches(record, query) {
  return Object.entries(query).every(([key, value]) => record[key] === value);
}

function entity(initial = [], options = {}) {
  const records = initial.map((record) => ({ ...record }));
  let sequence = records.length;
  let idReads = 0;
  return {
    records,
    async filter(query, _sort, limit = 500, skip = 0) {
      if (Object.keys(query).length === 1 && query.id) {
        idReads++;
        options.onIdRead?.({ idReads, records, id: query.id });
      }
      return records.filter((record) => matches(record, query)).slice(skip, skip + limit);
    },
    async create(data) {
      if (options.createError) throw options.createError;
      const record = { id: `record-${++sequence}`, ...data };
      records.push(record);
      return record;
    },
    async update(id, patch) {
      const record = records.find((candidate) => candidate.id === id);
      if (!record) throw new Error(`Missing record ${id}`);
      options.onUpdate?.({ id, patch: { ...patch }, records });
      Object.assign(record, patch);
      return { ...record };
    },
  };
}

function entities({
  reminders = [],
  messages = [],
  conversations = [{
    id: "conversation-1",
    type: "group",
    participant_ids: ["owner-1", "recipient-1", "recipient-2"],
  }],
  users = [{ id: "owner-1" }],
  entitled = true,
  notificationOptions,
  reminderOptions,
} = {}) {
  return {
    FollowUpReminder: entity(reminders, reminderOptions),
    Message: entity(messages),
    Conversation: entity(conversations),
    User: entity(users),
    Notification: entity([], notificationOptions),
    Subscription: entity(entitled ? [{
      id: "subscription-1",
      user_id: "owner-1",
      plan: "premium_plus",
      status: "active",
    }] : []),
  };
}

const sourceMessage = {
  id: "message-1",
  conversation_id: "conversation-1",
  sender_id: "owner-1",
  created_date: "2026-09-10T15:00:00.000Z",
};

const scheduledReminder = {
  id: "reminder-1",
  owner_id: "owner-1",
  conversation_id: "conversation-1",
  source_message_id: "message-1",
  source_message_created_at: sourceMessage.created_date,
  remind_at: "2026-09-10T16:00:00.000Z",
  status: "scheduled",
  resolution_reason: null,
  client_request_key: "follow-up:test-1",
  scheduled_at: "2026-09-10T15:05:00.000Z",
};

async function createReminder(overrides = {}) {
  const store = entities({
    messages: [sourceMessage],
    ...overrides,
  });
  const result = await createFollowUpReminder({
    entities: store,
    user: { id: "owner-1" },
    sourceMessageId: "message-1",
    remindAt: "2026-09-10T16:00:00.000Z",
    requestKey: "follow-up:create-1",
    now: "2026-09-10T15:10:00.000Z",
  });
  return { store, result };
}

describe("follow-up reminder authorization and creation", () => {
  it("reads Base44's canonical entity_id from trigger envelopes", () => {
    expect(messageIdFromEntityEvent({
      event: { entity_id: "message-canonical", id: "message-legacy" },
      data: { id: "message-data" },
    })).toBe("message-canonical");
  });

  it("keeps core chat free while follow-up reminders stay Premium Plus only", () => {
    const free = resolveEntitlements("free", "active");
    expect(free["chat.core"]).toBe(true);
    expect(free["reminders.follow_up"]).toBe(false);
  });

  it("requires an authenticated user", async () => {
    const store = entities({ messages: [sourceMessage] });
    await expect(createFollowUpReminder({
      entities: store,
      user: null,
      sourceMessageId: sourceMessage.id,
      remindAt: "2026-09-10T16:00:00.000Z",
      requestKey: "follow-up:create-1",
      now: "2026-09-10T15:10:00.000Z",
    })).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  it("enforces the canonical Premium Plus entitlement", async () => {
    const store = entities({ messages: [sourceMessage], entitled: false });
    await expect(createFollowUpReminder({
      entities: store,
      user: { id: "owner-1" },
      sourceMessageId: sourceMessage.id,
      remindAt: "2026-09-10T16:00:00.000Z",
      requestKey: "follow-up:create-1",
      now: "2026-09-10T15:10:00.000Z",
    })).rejects.toMatchObject({
      status: 403,
      code: "FOLLOW_UP_ENTITLEMENT_REQUIRED",
    });
  });

  it("rejects a source message owned by another participant", async () => {
    const store = entities({
      messages: [{ ...sourceMessage, sender_id: "recipient-1" }],
    });
    await expect(createFollowUpReminder({
      entities: store,
      user: { id: "owner-1" },
      sourceMessageId: sourceMessage.id,
      remindAt: "2026-09-10T16:00:00.000Z",
      requestKey: "follow-up:create-1",
      now: "2026-09-10T15:10:00.000Z",
    })).rejects.toMatchObject({ status: 403, code: "SOURCE_MESSAGE_NOT_OWNED" });
  });

  it("returns the same reminder for an idempotent duplicate request", async () => {
    const { store, result } = await createReminder();
    const duplicate = await createFollowUpReminder({
      entities: store,
      user: { id: "owner-1" },
      sourceMessageId: sourceMessage.id,
      remindAt: "2026-09-10T16:00:00.000Z",
      requestKey: "follow-up:create-1",
      now: "2026-09-10T15:10:01.000Z",
    });
    expect(duplicate).toEqual({ reminder: result.reminder, duplicate: true });
    expect(store.FollowUpReminder.records).toHaveLength(1);
  });

  it("rejects past times and times beyond the one-year bound", async () => {
    const store = entities({ messages: [sourceMessage] });
    const now = new Date("2026-09-10T15:10:00.000Z");
    const call = (remindAt, requestKey) => createFollowUpReminder({
      entities: store,
      user: { id: "owner-1" },
      sourceMessageId: sourceMessage.id,
      remindAt,
      requestKey,
      now,
    });
    await expect(call(now.toISOString(), "follow-up:past-1"))
      .rejects.toMatchObject({ code: "REMINDER_TIME_IN_PAST" });
    await expect(call(
      new Date(now.getTime() + MAX_REMINDER_DELAY_MS + 1).toISOString(),
      "follow-up:future-1",
    )).rejects.toMatchObject({ code: "REMINDER_TIME_TOO_FAR" });
  });
});

describe("follow-up reply resolution", () => {
  it("clears a group reminder for any other participant's later message", async () => {
    for (const senderId of ["recipient-1", "recipient-2"]) {
      const store = entities({ reminders: [scheduledReminder] });
      const completed = await resolveFollowUpRemindersForMessage({
        entities: store,
        message: {
          id: `reply-${senderId}`,
          conversation_id: "conversation-1",
          sender_id: senderId,
          created_date: "2026-09-10T15:00:00.001Z",
        },
        now: "2026-09-10T15:01:00.000Z",
      });
      expect(completed).toBe(1);
      expect(store.FollowUpReminder.records[0]).toMatchObject({
        status: "completed",
        resolution_reason: "recipient_reply",
      });
    }
  });

  it("does not clear for owner messages or equal timestamps", async () => {
    for (const message of [
      {
        id: "owner-message",
        conversation_id: "conversation-1",
        sender_id: "owner-1",
        created_date: "2026-09-10T15:01:00.000Z",
      },
      {
        id: "same-time-message",
        conversation_id: "conversation-1",
        sender_id: "recipient-1",
        created_date: sourceMessage.created_date,
      },
    ]) {
      const store = entities({ reminders: [scheduledReminder] });
      expect(await resolveFollowUpRemindersForMessage({
        entities: store,
        message,
        now: "2026-09-10T15:01:00.000Z",
      })).toBe(0);
      expect(store.FollowUpReminder.records[0].status).toBe("scheduled");
    }
  });

  it("does not clear for a later message from a non-participant", async () => {
    const store = entities({ reminders: [scheduledReminder] });
    expect(await resolveFollowUpRemindersForMessage({
      entities: store,
      message: {
        id: "outsider-message",
        conversation_id: "conversation-1",
        sender_id: "outsider-1",
        created_date: "2026-09-10T15:01:00.000Z",
      },
    })).toBe(0);
    expect(store.FollowUpReminder.records[0].status).toBe("scheduled");
  });

  it("is idempotent for duplicated realtime delivery", async () => {
    const store = entities({ reminders: [scheduledReminder] });
    const message = {
      id: "reply-1",
      conversation_id: "conversation-1",
      sender_id: "recipient-1",
      created_date: "2026-09-10T15:01:00.000Z",
    };
    expect(await resolveFollowUpRemindersForMessage({ entities: store, message })).toBe(1);
    expect(await resolveFollowUpRemindersForMessage({ entities: store, message })).toBe(0);
  });
});

describe("due follow-up processing", () => {
  it("does not notify after a cancellation wins the final state recheck", async () => {
    const store = entities({
      reminders: [scheduledReminder],
      messages: [sourceMessage],
      reminderOptions: {
        onIdRead({ idReads, records }) {
          if (idReads === 2) {
            Object.assign(records[0], {
              status: "canceled",
              resolution_reason: "user_canceled",
            });
          }
        },
      },
    });
    const summary = await processDueFollowUpReminders({
      entities: store,
      now: "2026-09-10T16:00:00.000Z",
    });
    expect(summary.triggered).toBe(0);
    expect(store.Notification.records).toHaveLength(0);
  });

  it("keeps triggered_at empty until notification delivery is confirmed", async () => {
    const claimPatches = [];
    const store = entities({
      reminders: [scheduledReminder],
      messages: [sourceMessage],
      reminderOptions: {
        onUpdate({ patch }) {
          if (patch.status === "triggered") claimPatches.push(patch);
        },
      },
    });

    const summary = await processDueFollowUpReminders({
      entities: store,
      now: "2026-09-10T16:00:00.000Z",
    });

    expect(summary.triggered).toBe(1);
    expect(claimPatches[0]).toMatchObject({
      status: "triggered",
      triggered_at: null,
    });
    expect(store.FollowUpReminder.records[0].triggered_at).toBeTruthy();
  });

  it("completes instead of notifying when a later recipient reply exists", async () => {
    const store = entities({
      reminders: [scheduledReminder],
      messages: [
        sourceMessage,
        {
          id: "reply-1",
          conversation_id: "conversation-1",
          sender_id: "recipient-2",
          created_date: "2026-09-10T15:30:00.000Z",
        },
      ],
    });
    const summary = await processDueFollowUpReminders({
      entities: store,
      now: "2026-09-10T16:00:00.000Z",
    });
    expect(summary).toMatchObject({ completed: 1, triggered: 0 });
    expect(store.Notification.records).toHaveLength(0);
  });

  it("marks notification failures explicitly", async () => {
    const store = entities({
      reminders: [scheduledReminder],
      messages: [sourceMessage],
      notificationOptions: { createError: new Error("notification unavailable") },
    });

    const summary = await processDueFollowUpReminders({
      entities: store,
      now: "2026-09-10T16:00:00.000Z",
    });
    expect(summary.failed).toBe(1);
    expect(store.FollowUpReminder.records[0]).toMatchObject({
      status: "failed",
      resolution_reason: "notification_failed",
    });
  });

  it("recovers an interrupted delivery claim without falsely reporting it as sent", async () => {
    const interrupted = {
      ...scheduledReminder,
      status: "triggered",
      triggered_at: null,
      last_attempt_at: "2026-09-10T15:50:00.000Z",
      delivery_claim_key: "delivery:interrupted",
    };
    const store = entities({
      reminders: [interrupted],
      messages: [sourceMessage],
    });
    const summary = await processDueFollowUpReminders({
      entities: store,
      now: "2026-09-10T16:00:00.000Z",
    });
    expect(summary.triggered).toBe(1);
    expect(store.Notification.records).toHaveLength(1);
    expect(store.FollowUpReminder.records[0]).toMatchObject({
      status: "triggered",
      delivery_notification_id: store.Notification.records[0].id,
    });
    expect(store.FollowUpReminder.records[0].triggered_at).toBeTruthy();
  });

  it("cancels after downgrade and when the source is deleted", async () => {
    const downgraded = entities({
      reminders: [scheduledReminder],
      messages: [sourceMessage],
      entitled: false,
    });

    await processDueFollowUpReminders({
      entities: downgraded,
      now: "2026-09-10T16:00:00.000Z",
    });
    expect(downgraded.FollowUpReminder.records[0]).toMatchObject({
      status: "canceled",
      resolution_reason: "owner_ineligible",
    });

    const deleted = entities({ reminders: [scheduledReminder], messages: [] });
    await processDueFollowUpReminders({
      entities: deleted,
      now: "2026-09-10T16:00:00.000Z",
    });
    expect(deleted.FollowUpReminder.records[0]).toMatchObject({
      status: "canceled",
      resolution_reason: "source_deleted",
    });
  });

  it("cancels when the conversation is deleted or the owner is blocked", async () => {
    const deletedConversation = entities({
      reminders: [scheduledReminder],
      messages: [sourceMessage],
      conversations: [],
    });
    await processDueFollowUpReminders({
      entities: deletedConversation,
      now: "2026-09-10T16:00:00.000Z",
    });
    expect(deletedConversation.FollowUpReminder.records[0]).toMatchObject({
      status: "canceled",
      resolution_reason: "conversation_deleted",
    });

    const blockedOwner = entities({
      reminders: [scheduledReminder],
      messages: [sourceMessage],
      users: [{ id: "owner-1", is_banned: true }],
    });
    await processDueFollowUpReminders({
      entities: blockedOwner,
      now: "2026-09-10T16:00:00.000Z",
    });
    expect(blockedOwner.FollowUpReminder.records[0]).toMatchObject({
      status: "canceled",
      resolution_reason: "owner_blocked",
    });
  });

  it("only lets the owner cancel a scheduled reminder", async () => {
    const store = entities({ reminders: [scheduledReminder] });
    await expect(cancelFollowUpReminder({
      entities: store,
      user: { id: "recipient-1" },
      reminderId: "reminder-1",
      now: "2026-09-10T15:30:00.000Z",
    })).rejects.toBeInstanceOf(FollowUpReminderError);
    expect(store.FollowUpReminder.records[0].status).toBe("scheduled");
  });
});
