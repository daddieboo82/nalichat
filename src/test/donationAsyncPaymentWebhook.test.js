import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";

describe("donation delayed settlement", () => {
  it("handles Stripe's signed async success event through the paid-status-gated checkout reconciliation", async () => {
    const webhook = await fs.readFile("base44/functions/stripeWebhook/entry.ts", "utf8");
    expect(webhook).toContain("'checkout.session.async_payment_succeeded'");
    expect(webhook).toContain("case 'checkout.session.async_payment_succeeded':");
    expect(webhook).toContain("await processCheckout(entities, object, event, catalog, environment)");
    expect(webhook).toContain("if (session.payment_status !== 'paid')");
    expect(webhook).toContain("verifyStripeSignature");
  });
});