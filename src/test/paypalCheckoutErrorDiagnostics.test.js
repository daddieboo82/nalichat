import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { checkoutFailureCategory } from "@/lib/subscriptionBilling";
import { checkoutErrorBreakdown } from "@/components/admin/PremiumConversionScorecard";

describe("safe PayPal failure diagnostics", () => {
  it("classifies known backend codes and anonymous HTTP failures", () => {
    expect(checkoutFailureCategory({ code: "PAYPAL_CHECKOUT_UNCERTAIN" })).toBe("PAYPAL_CHECKOUT_UNCERTAIN");
    expect(checkoutFailureCategory({ response: { status: 409 } })).toBe("EXISTING_BILLING_REVIEW");
    expect(checkoutFailureCategory({ response: { status: 503 } })).toBe("SERVICE_UNAVAILABLE");
    expect(checkoutFailureCategory({ code: "secret-debug-id" })).toBe("UNCLASSIFIED_CHECKOUT_ERROR");
  });

  it("keeps diagnostic details allowlisted and read only", async () => {
    const client = await readFile("src/lib/subscriptionBilling.js", "utf8");
    const product = await readFile("src/lib/productAnalytics.js", "utf8");
    expect(client).toContain("recordCheckoutFailure(error, sku)");
    expect(client).toContain('trackProductEvent("checkout_error_diagnostic"');
    expect(client).not.toContain("trackProductEvent(error.message");
    expect(product).toContain('"checkout_error_diagnostic"');
    expect(checkoutErrorBreakdown([
      { event_name: "checkout_error_diagnostic", metadata: { reason: "PAYPAL_CHECKOUT_UNCERTAIN" } },
      { event_name: "checkout_error_diagnostic", metadata: { reason: "sensitive detail" } },
    ])).toEqual({ PAYPAL_CHECKOUT_UNCERTAIN: 1, UNCLASSIFIED_CHECKOUT_ERROR: 1 });
  });
});