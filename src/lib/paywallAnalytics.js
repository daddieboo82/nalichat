import { trackProductEvent } from "@/lib/productAnalytics";

const EVENT_NAMES = new Set([
  "paywall_view",
  "paywall_billing_toggle",
  "paywall_tier_select",
  "paywall_primary_cta",
  "paywall_secondary_cta",
  "paywall_dismissed",
  "checkout_started",
  "trial_started",
  "purchase_completed",
  "purchase_failed",
  "billing_portal_opened",
  "entitlement_prompt_view",
  "entitlement_prompt_convert",
  "registration_view",
  "registration_started",
  "registration_completed",
  "registration_failed",
]);

const ALLOWED_FIELDS = new Set([
  "variant",
  "plan",
  "billing_period",
  "sku",
  "entitlement",
  "source",
  "outcome",
  // Non-PII campaign context used to connect ad acquisition with funnel outcomes.
  "campaign_source",
  "campaign_medium",
  "campaign_name",
  "campaign_term",
  "campaign_content",
  "campaign_landing_path",
  "google_ads_click",
  "upgrade_feature",
  "checkout_sku",
]);

let reportedUnavailable = false;

export function trackPaywallEvent(name, properties = {}) {
  if (!EVENT_NAMES.has(name)) {
    throw new Error(`Unknown paywall analytics event: ${name}`);
  }

  const safeProperties = Object.fromEntries(
    Object.entries(properties)
      .filter(([key, value]) => ALLOWED_FIELDS.has(key) && ["string", "boolean", "number"].includes(typeof value)),
  );

  trackProductEvent(name, safeProperties);

  const analytics = typeof window !== "undefined" ? Reflect.get(window, "gtag") : null;
  if (typeof analytics === "function") {
    analytics("event", name, safeProperties);
    return true;
  }
  if (!reportedUnavailable) {
    console.info("Paywall analytics adapter is unavailable; events will remain local.");
    reportedUnavailable = true;
  }
  return false;
}
