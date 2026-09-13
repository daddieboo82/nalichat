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
      data: {
        success: true,
        action: "create_subscription_checkout",
        userId: "user-123",
        sku: "premium_plus_yearly",
        idempotencyKey: "checkout_request_1234",
        successDestination: "subscription_thank_you",
        cancelDestination: "pricing",
        checkoutUrl: "https://checkout.stripe.test/session",
      },
    });
    const redirect = vi.fn();

    await startSubscriptionCheckout({
      sku: "premium_plus_yearly",
      idempotencyKey: "checkout_request_1234",
      expectedUserId: "user-123",
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

  it("rejects a checkout response for another account", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        success: true,
        action: "create_subscription_checkout",
        userId: "other-user",
        sku: "premium_plus_yearly",
        idempotencyKey: "checkout_request_1234",
        successDestination: "subscription_thank_you",
        cancelDestination: "pricing",
        checkoutUrl: "https://checkout.stripe.test/session",
      },
    });
    const redirect = vi.fn();

    await expect(startSubscriptionCheckout({
      sku: "premium_plus_yearly",
      idempotencyKey: "checkout_request_1234",
      expectedUserId: "user-123",
      invoke,
      redirect,
    })).rejects.toThrow("Subscription checkout response was not confirmed");

    expect(redirect).not.toHaveBeenCalled();
  });

  it("opens the server-created Stripe billing portal", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        success: true,
        action: "create_billing_portal",
        userId: "user-123",
        returnDestination: "settings",
        portalUrl: "https://billing.stripe.test/session",
      },
    });
    const redirect = vi.fn();

    await openBillingPortal({ expectedUserId: "user-123", invoke, redirect });

    expect(invoke).toHaveBeenCalledWith("createBillingPortal", {
      returnDestination: "settings",
    });
    expect(redirect).toHaveBeenCalledWith("https://billing.stripe.test/session");
  });

  it("rejects a billing portal response for another account", async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        success: true,
        action: "create_billing_portal",
        userId: "other-user",
        returnDestination: "settings",
        portalUrl: "https://billing.stripe.test/session",
      },
    });
    const redirect = vi.fn();

    await expect(openBillingPortal({
      expectedUserId: "user-123",
      invoke,
      redirect,
    })).rejects.toThrow("Billing portal response was not confirmed");

    expect(redirect).not.toHaveBeenCalled();
  });
});
