import { base44 } from "@/api/base44Client";
import { trackProductEvent } from "@/lib/productAnalytics";

export const CHECKOUT_RETURN_KEY = "nalichat_subscription_checkout_started";
export const CHECKOUT_ATTRIBUTION_KEY = "nalichat_subscription_checkout_attribution";
export const CHECKOUT_SUBSCRIPTION_ID_KEY = "nalichat_subscription_checkout_agreement_id";

export function createCheckoutRequestKey() {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (!uuid) {
    throw new Error("Secure checkout request IDs are unavailable in this browser");
  }
  return uuid;
}

function responsePayload(response) {
  const payload = response?.data ?? response;
  if (payload?.error) {
    const error = new Error(payload.error);
    if (typeof payload.code === "string") error.code = payload.code;
    throw error;
  }
  return payload;
}

// Base44 HTTP errors reject the invocation before responsePayload runs.
// Preserve the backend's safe, user-facing billing explanation and error code
// rather than replacing it with "Request failed with status code 409".
async function invokeBillingFunction(invoke, functionName, args) {
  try {
    return await invoke(functionName, args);
  } catch (cause) {
    const payload = cause?.response?.data ?? cause?.data;
    if (typeof payload?.error === "string" && payload.error.trim()) {
      const error = new Error(payload.error);
      if (typeof payload.code === "string") error.code = payload.code;
      throw error;
    }
    throw cause;
  }
}

// Record only a fixed, non-sensitive failure class. Never send provider payloads,
// PayPal agreement IDs, customer messages or credentials to conversion analytics.
const CHECKOUT_FAILURE_CODES = new Set([
  "PAYPAL_PLAN_CONFIGURATION_REQUIRED",
  "PAYPAL_AGREEMENT_RECONCILIATION_REQUIRED",
  "PAYPAL_CHECKOUT_UNCERTAIN",
  "CHECKOUT_DEPENDENCY_ERROR",
]);
export function checkoutFailureCategory(error) {
  if (CHECKOUT_FAILURE_CODES.has(error?.code)) return error.code;
  const status = Number(error?.response?.status || error?.status);
  if (status === 409) return "EXISTING_BILLING_REVIEW";
  if (status === 401 || status === 403) return "AUTH_REQUIRED";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500 && status < 600) return "SERVICE_UNAVAILABLE";
  return "UNCLASSIFIED_CHECKOUT_ERROR";
}

function recordCheckoutFailure(error, sku) {
  try {
    trackProductEvent("checkout_error_diagnostic", {
      source: "paypal_checkout",
      sku: typeof sku === "string" ? sku : "unknown",
      reason: checkoutFailureCategory(error),
    });
  } catch {
    // Error instrumentation never blocks checkout recovery.
  }
}

export async function startSubscriptionCheckout({
  sku,
  idempotencyKey,
  cancelDestination = "pricing",
  expectedUserId,
  invoke = base44.functions.invoke,
  redirect = (url) => window.location.assign(url),
}) {
  let response;
  try {
    response = await invokeBillingFunction(invoke, "createPayPalSubscription", { sku, idempotencyKey });
  } catch (error) {
    recordCheckoutFailure(error, sku);
    throw error;
  }
  const payload = responsePayload(response);
  if (
    payload?.success !== true ||
    payload?.action !== "create_paypal_subscription" ||
    (expectedUserId && payload?.userId !== expectedUserId) ||
    payload?.sku !== sku ||
    typeof payload?.subscriptionId !== "string" ||
    !/^I-[A-Za-z0-9-]+$/.test(payload.subscriptionId) ||
    typeof payload?.checkoutUrl !== "string" ||
    !payload.checkoutUrl.trim()
  ) {
    throw new Error("Subscription checkout response was not confirmed");
  }
  let checkoutUrl;
  try {
    checkoutUrl = new URL(payload.checkoutUrl);
  } catch {
    throw new Error("PayPal checkout URL is invalid");
  }
  if (checkoutUrl.protocol !== "https:" || !["www.paypal.com", "www.sandbox.paypal.com"].includes(checkoutUrl.hostname)) {
    throw new Error("PayPal checkout URL was not trusted");
  }
  // Store only the server-created PayPal agreement for return-page attribution.
  // Never use this browser value as proof of payment or grant entitlements.
  try {
    sessionStorage.setItem(CHECKOUT_SUBSCRIPTION_ID_KEY, payload.subscriptionId);
  } catch { /* Storage may be unavailable on restricted browsers. */ }
  redirect(checkoutUrl.toString());
  return payload;
}

// Existing PayPal approval only: the backend verifies the currently signed-in
// user's exact agreement and returns PayPal's current approval URL. No new
// provider subscription is created by this action.
export async function resumePendingPayPalApproval({
  expectedUserId,
  invoke = base44.functions.invoke,
  redirect = (url) => window.location.assign(url),
} = {}) {
  const response = await invokeBillingFunction(invoke, "resumePendingPayPal", {});
  const payload = responsePayload(response);
  if (payload?.success !== true || payload?.action !== "resume_pending_paypal" ||
    (expectedUserId && payload?.userId !== expectedUserId) ||
    typeof payload?.subscriptionId !== "string" || !payload.subscriptionId ||
    typeof payload?.checkoutUrl !== "string") {
    throw new Error("Existing PayPal approval could not be confirmed");
  }
  let checkoutUrl;
  try { checkoutUrl = new URL(payload.checkoutUrl); } catch {
    throw new Error("PayPal approval URL is invalid");
  }
  if (checkoutUrl.protocol !== "https:" ||
    !["www.paypal.com", "www.sandbox.paypal.com"].includes(checkoutUrl.hostname)) {
    throw new Error("PayPal approval URL was not trusted");
  }
  // A resumed approval must use the same return-page agreement matching as
  // a newly created checkout. This ID identifies an agreement, not payment.
  try {
    sessionStorage.setItem(CHECKOUT_SUBSCRIPTION_ID_KEY, payload.subscriptionId);
  } catch { /* Some browsers restrict storage; paid access is still server-verified. */ }
  redirect(checkoutUrl.toString());
  return payload;
}

export async function openBillingPortal({
  returnDestination = "settings",
  expectedUserId,
  invoke = base44.functions.invoke,
  redirect = (url) => window.location.assign(url),
} = {}) {
  const response = await invokeBillingFunction(invoke, "createBillingPortal", { returnDestination });
  const payload = responsePayload(response);
  if (
    payload?.success !== true ||
    payload?.action !== "create_billing_portal" ||
    (expectedUserId && payload?.userId !== expectedUserId) ||
    payload?.returnDestination !== returnDestination ||
    typeof payload?.portalUrl !== "string" ||
    !payload.portalUrl.trim()
  ) {
    throw new Error("Billing portal response was not confirmed");
  }
  redirect(payload.portalUrl);
  return payload;
}