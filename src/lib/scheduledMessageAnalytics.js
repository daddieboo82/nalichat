const EVENT_NAMES = new Set([
  "scheduled_message_prompt",
  "scheduled_message_created",
  "scheduled_message_updated",
  "scheduled_message_canceled",
  "scheduled_message_error",
]);

const ALLOWED_FIELDS = new Set([
  "source",
  "outcome",
  "status",
  "failure_code",
  "lead_minutes",
]);

export function trackScheduledMessageEvent(name, properties = {}) {
  if (!EVENT_NAMES.has(name)) {
    throw new Error(`Unknown scheduled-message analytics event: ${name}`);
  }
  const safeProperties = Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => (
      ALLOWED_FIELDS.has(key)
      && ["string", "boolean", "number"].includes(typeof value)
    )),
  );
  const analytics = typeof window !== "undefined" ? Reflect.get(window, "gtag") : null;
  if (typeof analytics !== "function") return false;
  analytics("event", name, safeProperties);
  return true;
}
