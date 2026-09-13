import { base44 } from "@/api/base44Client";

const pad = (value) => String(value).padStart(2, "0");

export function toLocalDateTimeInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

export function localDateTimeToUtc(value) {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function defaultReminderTime(now = new Date()) {
  return toLocalDateTimeInput(new Date(now.getTime() + 30 * 60 * 1000));
}

export function localTimeZoneLabel() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";
}

export function formatReminderTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function createReminderRequestKey() {
  if (globalThis.crypto?.randomUUID) return `follow-up:${globalThis.crypto.randomUUID()}`;
  return `follow-up:${Date.now()}:${Math.random().toString(36).slice(2, 12)}`;
}

async function invokeReminderFunction(name, payload = {}) {
  const response = await base44.functions.invoke(name, payload);
  return response?.data || response;
}

export async function createFollowUpReminder({ sourceMessageId, remindAt, requestKey, userId }) {
  const data = await invokeReminderFunction("createFollowUpReminder", {
    source_message_id: sourceMessageId,
    remind_at: remindAt,
    client_request_key: requestKey,
  });
  if (
    data?.success !== true ||
    data?.action !== "create_reminder" ||
    data?.userId !== userId ||
    data?.sourceMessageId !== sourceMessageId ||
    data?.requestKey !== requestKey ||
    data?.reminder?.owner_id !== userId ||
    data?.reminder?.source_message_id !== sourceMessageId
  ) {
    throw new Error("Follow-up reminder creation was not confirmed.");
  }
  return data;
}

export async function listFollowUpReminders(userId) {
  const data = await invokeReminderFunction("listFollowUpReminders");
  if (
    data?.success !== true ||
    data?.action !== "list_reminders" ||
    data?.userId !== userId ||
    !Array.isArray(data?.reminders) ||
    data.reminders.some((reminder) => reminder?.owner_id !== userId)
  ) {
    throw new Error("Follow-up reminder list was not confirmed.");
  }
  return data.reminders;
}

export async function rescheduleFollowUpReminder(reminderId, remindAt, userId) {
  const data = await invokeReminderFunction("rescheduleFollowUpReminder", {
    reminder_id: reminderId,
    remind_at: remindAt,
  });
  if (
    data?.success !== true ||
    data?.action !== "reschedule_reminder" ||
    data?.userId !== userId ||
    data?.reminderId !== reminderId ||
    data?.reminder?.owner_id !== userId ||
    data?.reminder?.id !== reminderId
  ) {
    throw new Error("Follow-up reminder reschedule was not confirmed.");
  }
  return data.reminder;
}

export async function cancelFollowUpReminder(reminderId, userId) {
  const data = await invokeReminderFunction("cancelFollowUpReminder", {
    reminder_id: reminderId,
  });
  if (
    data?.success !== true ||
    data?.action !== "cancel_reminder" ||
    data?.userId !== userId ||
    data?.reminderId !== reminderId ||
    data?.reminder?.owner_id !== userId ||
    data?.reminder?.id !== reminderId
  ) {
    throw new Error("Follow-up reminder cancellation was not confirmed.");
  }
  return data.reminder;
}
