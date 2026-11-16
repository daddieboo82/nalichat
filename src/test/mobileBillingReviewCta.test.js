import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
describe("Mobile Premium CTA billing safety", () => {
  it("routes new buyers to pricing and unresolved subscribers to billing review", async () => {
    const header = await readFile("src/components/navigation/MobileHeader.jsx", "utf8");
    const analytics = await readFile("src/lib/productAnalytics.js", "utf8");
    expect(header).toContain("subscriptionError || subscription.hasPending");
    expect(header).toContain('navigate("/settings")');
    expect(header).toContain('navigate("/pricing?source=mobile_header_upgrade")');
    expect(header).toContain('billingReviewNeeded ? "Review existing billing" : "Upgrade to Premium"');
    expect(header).toContain('billing_review_click');
    expect(analytics).toContain('"billing_review_click"');
    expect(header).not.toContain('createPayPalSubscription');
  });
});