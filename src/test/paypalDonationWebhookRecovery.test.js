import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("signed PayPal donation webhook recovery", () => {
  it("receives approved one-time orders through the same verified event ledger", async () => {
    const webhook = await readFile("base44/functions/paypalWebhook/entry.ts", "utf8");
    expect(webhook).toContain("'CHECKOUT.ORDER.APPROVED'");
    expect(webhook.indexOf("const verified = await verify(req, event, token)")).toBeLessThan(
      webhook.indexOf("await settleApprovedDonation(entities, token"));
    expect(webhook.indexOf("const ledgerAction = paypalWebhookLedgerAction")).toBeLessThan(
      webhook.indexOf("await settleApprovedDonation(entities, token"));
    expect(webhook).toContain("if (record.status !== 'paid')");
    expect(webhook).toContain("capture?.status !== 'COMPLETED'");
    expect(webhook).toContain("capture?.amount?.value !== amount");
    expect(webhook).toContain("'capture:' + orderId");
    expect(webhook).toContain("PayPalDonation.update(record.id");
  });

  it("requires provider webhook event subscription before certification", async () => {
    const setup = await readFile("base44/functions/setupPayPalWebhook/entry.ts", "utf8");
    expect(setup).toContain("'CHECKOUT.ORDER.APPROVED'");
    expect(setup).toContain("missingEvents");
    expect(setup).toContain("verified: verified");
  });
});