import { base44 } from "@/api/base44Client";

export const CHECKOUT_RETURN_KEY = "nalichat_subscription_checkout_started";

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
    throw new Error(payload.error);
  }
  return payload;
}

export async function startSubscriptionCheckout({
  sku,
  idempotencyKey,
  cancelDestination = "pricing",
  expectedUserId,
  invoke = base44.functions.invoke,
  redirect = (url) => window.location.assign(url),
}) {
  const response = await invoke("createSubscriptionCheckout", {
    sku,
    idempotencyKey,
    callbackDestinations: {
      success: "subscription_thank_you",
      cancel: cancelDestination,
    },
  });
  const payload = responsePayload(response);
  if (
    payload?.success !== true ||
    payload?.action !== "create_subscription_checkout" ||
    (expectedUserId && payload?.userId !== expectedUserId) ||
    payload?.sku !== sku ||
    typeof payload?.idempotencyKey !== "string" ||
    !payload.idempotencyKey.trim() ||
    payload?.successDestination !== "subscription_thank_you" ||
    payload?.cancelDestination !== cancelDestination ||
    typeof payload?.checkoutUrl !== "string" ||
    !payload.checkoutUrl.trim()
  ) {
    throw new Error("Subscription checkout response was not confirmed");
  }
  redirect(payload.checkoutUrl);
  return payload;
}

export async function openBillingPortal({
  returnDestination = "settings",
  expectedUserId,
  invoke = base44.functions.invoke,
  redirect = (url) => window.location.assign(url),
} = {}) {
  const response = await invoke("createBillingPortal", { returnDestination });
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
