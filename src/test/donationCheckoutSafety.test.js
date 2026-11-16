import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

describe("Donation checkout integrity", () => {
  it("uses the canonical permitted callback origin and never counts conversions before payment", async () => {
    const button = await readFile("src/components/home/DonationButton.jsx", "utf8");
    // Donations now run on PayPal: only a server-issued approval URL on a
    // trusted PayPal host may receive the donor.
    expect(button).toContain('["www.paypal.com", "www.sandbox.paypal.com"].includes(url.hostname)');
    expect(button).toContain('if (url.protocol !== "https:" || !trustedHost)');
    expect(button).toContain("window.location.assign(url.toString())");
    expect(button).not.toContain("window.gtag('event', 'conversion'");
    expect(button).toContain("!PRESETS.includes(amount)");
  });

  it("requires authoritative Stripe payment status and exact checkout identity on return", async () => {
    const verifier = await readFile("base44/functions/verifyCheckoutPayment/entry.ts", "utf8");
    expect(verifier).toContain("session.id !== normalizedCheckoutId");
    expect(verifier).toContain("session.mode !== 'payment'");
    expect(verifier).toContain("session.payment_status !== 'paid'");
    expect(verifier).toContain("status: session.status === 'complete' ? 'pending' : 'unpaid'");
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