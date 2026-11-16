import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

describe("Donation checkout integrity", () => {
  it("uses the canonical permitted callback origin and never counts conversions before payment", async () => {
    const button = await readFile("src/components/home/DonationButton.jsx", "utf8");
    expect(button).toContain('const appUrl = "https://nalichat.org"');
    expect(button).toContain('thankYouPageUrl: appUrl + "/ThankYou"');
    expect(button).toContain('["checkout.stripe.com", "checkout.stripe.dev"]');
    expect(button).toContain('window.location.assign(destination.toString())');
    expect(button).not.toContain("window.gtag('event', 'conversion'");
    expect(button).toContain("PRESETS.includes(amount)");
  });

  it("requires authoritative Stripe payment status and exact checkout identity on return", async () => {
    const verifier = await readFile("base44/functions/verifyCheckoutPayment/entry.ts", "utf8");
    expect(verifier).toContain("session.id !== normalizedCheckoutId");
    expect(verifier).toContain("session.mode !== 'payment'");
    expect(verifier).toContain("session.payment_status !== 'paid'");
    expect(verifier).toContain("status: 'unpaid'");
    expect(verifier).not.toContain("purchase.status === 'paid' ? 'paid' : session.payment_status");
    expect(verifier).toContain("purchase.purchase_verifier_hash");
  });

  it("retains server-side donation amounts and verifier-bound return", async () => {
    const checkout = await readFile("base44/functions/createCheckout/entry.ts", "utf8");
    expect(checkout).toContain("const DONATION_PRESETS = [5, 10, 25, 50]");
    expect(checkout).toContain("validateCallbackUrl");
    expect(checkout).toContain("purchase_verifier_hash: purchaseVerifierHash");
  });
});