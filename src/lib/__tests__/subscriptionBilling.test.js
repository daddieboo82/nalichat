import { describe, expect, it, vi } from "vitest";
import {
  openBillingPortal,
  startSubscriptionCheckout,
} from "@/lib/subscriptionBilling";

vi.mock("@/api/base44Client", () => ({
  base44: { functions: { invoke: vi.fn() } },
}));

describe("subscription billing client", () => {
  it("invokes checkout with only an approved SKU contract and server callbacks", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { checkoutUrl: "https://checkout.stripe.test/session" },
    });
    const redirect = vi.fn();

    await startSubscriptionCheckout({
      sku: "premium_plus_yearly",
      idempotencyKey: "checkout_request_1234",
      invoke,
      redirect,
    });

    expect(invoke).toHaveBeenCalledWith("createSubscriptionCheckout", {
      sku: "premium_plus_yearly",
      idempotencyKey: "checkout_request_1234",
      callbackDestinations: {
        success: "subscription_thank_you",
        cancel: "pricing",
      },
    });
    expect(redirect).toHaveBeenCalledWith("https://checkout.stripe.test/session");
  });

  it("opens the server-created Stripe billing portal", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: { portalUrl: "https://billing.stripe.test/session" },
    });
    const redirect = vi.fn();

    await openBillingPortal({ invoke, redirect });

    expect(invoke).toHaveBeenCalledWith("createBillingPortal", {
      returnDestination: "settings",
    });
    expect(redirect).toHaveBeenCalledWith("https://billing.stripe.test/session");
  });
});
