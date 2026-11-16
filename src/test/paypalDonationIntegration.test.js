import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("PayPal-only NaliChat donation checkout", () => {
  it("uses PayPal orders instead of Stripe for the donation CTA", async () => {
    const source = await readFile("src/components/home/DonationButton.jsx", "utf8");
    expect(source).toContain('base44.functions.invoke("createPayPalDonation", { amount })');
    expect(source).toContain('base44.functions.invoke("capturePayPalDonation", { orderId, verifier })');
    expect(source).not.toContain('base44.functions.invoke("createCheckout"');
    expect(source).not.toContain("checkout.stripe.com");
    expect(source).toContain("www.paypal.com");
    expect(source).toContain("www.sandbox.paypal.com");
  });

  it("only offers the approved donation amounts, without recurring billing", async () => {
    const create = await readFile("base44/functions/createPayPalDonation/entry.ts", "utf8");
    expect(create).toContain("new Set([5, 10, 25, 50])");
    expect(create).toContain("intent: 'CAPTURE'");
    expect(create).toContain("PayPalDonation.create");
    expect(create).toContain("verifier_hash: await sha256Hex(verifier)");
    expect(create).toContain("APP_BASE_URL + '/'");
    expect(create).not.toContain("billing/subscriptions");
  });

  it("only confirms donations after matching provider order and capture", async () => {
    const capture = await readFile("base44/functions/capturePayPalDonation/entry.ts", "utf8");
    expect(capture).toContain("record.verifier_hash !== await sha256Hex(verifier)");
    expect(capture).toContain("before.purchase_units[0]");
    expect(capture).toContain("capture?.status !== 'COMPLETED'");
    expect(capture).toContain("capture?.amount?.value !== expected");
    expect(capture).toContain("PayPalDonation.update(record.id");
    expect(capture).toContain("status: 'paid'");
  });
});
