const EVENTS = new Set([
  "follow_up_prompt_view",
  "follow_up_prompt_convert",
  "follow_up_create",
  "follow_up_reschedule",
  "follow_up_cancel",
]);

const ALLOWED_FIELDS = new Set(["outcome", "source", "status", "delay_bucket"]);

export function trackFollowUpEvent(name, properties = {}) {
  if (!EVENTS.has(name)) {
    throw new Error(`Unknown follow-up analytics event: ${name}`);
  }
  const safeProperties = Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => (
      ALLOWED_FIELDS.has(key)
      && ["string", "number", "boolean"].includes(typeof value)
    )),
  );
  const analytics = typeof window !== "undefined" ? Reflect.get(window, "gtag") : null;
  if (typeof analytics !== "function") return false;
  analytics("event", name, safeProperties);
  return true;
}
