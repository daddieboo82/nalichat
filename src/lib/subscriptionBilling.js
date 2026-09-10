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
  if (typeof payload?.checkoutUrl !== "string" || !payload.checkoutUrl) {
    throw new Error("No checkout URL returned");
  }
  redirect(payload.checkoutUrl);
  return payload;
}

export async function openBillingPortal({
  returnDestination = "settings",
  invoke = base44.functions.invoke,
  redirect = (url) => window.location.assign(url),
} = {}) {
  const response = await invoke("createBillingPortal", { returnDestination });
  const payload = responsePayload(response);
  if (typeof payload?.portalUrl !== "string" || !payload.portalUrl) {
    throw new Error("No billing portal URL returned");
  }
  redirect(payload.portalUrl);
  return payload;
}
