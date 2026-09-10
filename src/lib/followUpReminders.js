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

export async function createFollowUpReminder({ sourceMessageId, remindAt, requestKey }) {
  return invokeReminderFunction("createFollowUpReminder", {
    source_message_id: sourceMessageId,
    remind_at: remindAt,
    client_request_key: requestKey,
  });
}

export async function listFollowUpReminders() {
  const data = await invokeReminderFunction("listFollowUpReminders");
  return data?.reminders || [];
}

export async function rescheduleFollowUpReminder(reminderId, remindAt) {
  const data = await invokeReminderFunction("rescheduleFollowUpReminder", {
    reminder_id: reminderId,
    remind_at: remindAt,
  });
  return data?.reminder;
}

export async function cancelFollowUpReminder(reminderId) {
  const data = await invokeReminderFunction("cancelFollowUpReminder", {
    reminder_id: reminderId,
  });
  return data?.reminder;
}
