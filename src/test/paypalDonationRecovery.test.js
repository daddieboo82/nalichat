import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("PayPal donation return recovery", () => {
  it("offers rechecking the existing order instead of launching another checkout", async () => {
    const source = await readFile("src/components/home/DonationButton.jsx", "utf8");
    expect(source).toContain("PayPal donation awaiting confirmation");
    expect(source).toContain("Check payment again");
    expect(source).toContain("loading || donationPending || pendingOrder");
    expect(source).toContain('disabled={loading || donationPending || !!pendingOrder}');
    expect(source).toContain("setPendingOrder({ orderId, verifier })");
    expect(source).toContain("setPendingOrder(null)");
  });

  it("deduplicates simultaneous return verification when multiple donation buttons mount", async () => {
    const source = await readFile("src/components/home/DonationButton.jsx", "utf8");
    expect(source).toContain("const pendingCaptureRequests = new Map()");
    expect(source).toContain("if (pendingCaptureRequests.has(key)) return pendingCaptureRequests.get(key)");
    expect(source).toContain("pendingCaptureRequests.set(key, promise)");
    expect(source).toContain("verifyExistingDonation(orderId, verifier).then");
    expect(source).toContain("verifyExistingDonation(pendingOrder.orderId, pendingOrder.verifier)");
  });
});