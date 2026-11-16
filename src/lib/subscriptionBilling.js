import { base44 } from "@/api/base44Client";

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

export async function startSubscriptionCheckout({
  sku,
  idempotencyKey,
  cancelDestination = "pricing",
  expectedUserId,
  invoke = base44.functions.invoke,
  redirect = (url) => window.location.assign(url),
}) {
  const response = await invokeBillingFunction(invoke, "createPayPalSubscription", { sku, idempotencyKey });
  const payload = responsePayload(response);
  if (
    payload?.success !== true ||
    payload?.action !== "create_paypal_subscription" ||
    (expectedUserId && payload?.userId !== expectedUserId) ||
    payload?.sku !== sku ||
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
    if (typeof payload.subscriptionId === "string" && payload.subscriptionId) {
      sessionStorage.setItem(CHECKOUT_SUBSCRIPTION_ID_KEY, payload.subscriptionId);
    }
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