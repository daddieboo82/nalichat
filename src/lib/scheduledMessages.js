import { base44 } from "@/api/base44Client";

export const MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000;
export const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;

function parseLocalDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) throw new Error("Choose a valid local date and time.");
  const [, year, month, day, hour, minute] = match.map(Number);
  if (
    month < 1 || month > 12 || day < 1 || day > 31
    || hour < 0 || hour > 23 || minute < 0 || minute > 59
  ) {
    throw new Error("Choose a valid local date and time.");
  }
  return { year, month, day, hour, minute };
}

function matchesLocalParts(date, parts) {
  return date.getFullYear() === parts.year
    && date.getMonth() === parts.month - 1
    && date.getDate() === parts.day
    && date.getHours() === parts.hour
    && date.getMinutes() === parts.minute;
}

function formatOffset(offsetMinutes) {
  const total = -offsetMinutes;
  const sign = total >= 0 ? "+" : "-";
  const absolute = Math.abs(total);
  return `UTC${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

export function resolveLocalDateTime(value, preference = "earlier") {
  const parts = parseLocalDateTime(value);
  const wallClockUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
  );
  const dayMs = 24 * 60 * 60 * 1000;
  const offsets = new Set(
    [-2, -1, 0, 1, 2].map((days) => (
      new Date(wallClockUtc + days * dayMs).getTimezoneOffset()
    )),
  );
  const matches = [...offsets]
    .map((offset) => new Date(wallClockUtc + offset * 60 * 1000))
    .filter((candidate) => matchesLocalParts(candidate, parts))
    .sort((left, right) => left.getTime() - right.getTime());

  if (!matches.length) {
    throw new Error("That local time does not exist because of a daylight-saving transition.");
  }
  const selected = preference === "later" ? matches[matches.length - 1] : matches[0];
  return {
    iso: selected.toISOString(),
    ambiguous: matches.length > 1,
    options: matches.map((candidate, index) => ({
      value: index === 0 ? "earlier" : "later",
      iso: candidate.toISOString(),
      label: `${index === 0 ? "First" : "Second"} occurrence (${formatOffset(candidate.getTimezoneOffset())})`,
    })),
  };
}

export function toLocalDateTimeInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (part) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function defaultLocalScheduleTime(now = new Date()) {
  const rounded = new Date(now.getTime() + 15 * 60 * 1000);
  rounded.setSeconds(0, 0);
  return toLocalDateTimeInput(rounded);
}

export function validateClientSchedule(iso, now = new Date()) {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) throw new Error("Choose a valid schedule time.");
  if (timestamp < now.getTime() + MIN_SCHEDULE_LEAD_MS) {
    throw new Error("Choose a time at least 5 minutes from now.");
  }
  if (timestamp > now.getTime() + MAX_SCHEDULE_AHEAD_MS) {
    throw new Error("Choose a time within the next 365 days.");
  }
  return new Date(timestamp).toISOString();
}

export function createScheduledRequestKey() {
  return `schedule_${crypto.randomUUID().replaceAll("-", "")}`;
}

function functionError(error, fallback) {
  const data = error?.response?.data || error?.data;
  return Object.assign(
    new Error(data?.error || error?.message || fallback),
    { code: data?.code || "SCHEDULE_REQUEST_FAILED" },
  );
}

export async function createScheduledMessage(input, invoke = base44.functions.invoke.bind(base44.functions)) {
  try {
    const response = await invoke("createScheduledMessage", input);
    return response.data.scheduled_message;
  } catch (error) {
    throw functionError(error, "Unable to schedule the message.");
  }
}

export async function listScheduledMessages(conversationId, invoke = base44.functions.invoke.bind(base44.functions)) {
  try {
    const response = await invoke("listScheduledMessages", {
      conversation_id: conversationId,
    });
    return response.data.scheduled_messages || [];
  } catch (error) {
    throw functionError(error, "Unable to load scheduled messages.");
  }
}

export async function updateScheduledMessage(input, invoke = base44.functions.invoke.bind(base44.functions)) {
  try {
    const response = await invoke("updateScheduledMessage", input);
    return response.data.scheduled_message;
  } catch (error) {
    throw functionError(error, "Unable to update the scheduled message.");
  }
}

export async function cancelScheduledMessage(scheduledMessageId, invoke = base44.functions.invoke.bind(base44.functions)) {
  try {
    const response = await invoke("cancelScheduledMessage", {
      scheduled_message_id: scheduledMessageId,
    });
    return response.data.scheduled_message;
  } catch (error) {
    throw functionError(error, "Unable to cancel the scheduled message.");
  }
}
