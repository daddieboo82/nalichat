import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";

describe("Premium recovery across desktop and messaging banners", () => {
  it("routes pending and unverified paid statuses to Settings, not new checkout", async () => {
    const files = [
      "src/components/layout/AppLayout.jsx",
      "src/components/navigation/DesktopNav.jsx",
    ];
    for (const file of files) {
      const source = await fs.readFile(file, "utf8");
      expect(source).toContain("subscriptionError || subscription.hasPending");
      expect(source).toContain('billingReviewNeeded ? "/settings" : "/pricing?source=');
      expect(source).toContain('"billing_review_click"');
      expect(source).toContain('"upgrade_click"');
    }
  });
  it("offers retry and billing review for unverifiable premium chat themes", async () => {
    const source = await fs.readFile("src/components/subscription/InlineEntitlementPrompt.jsx", "utf8");
    expect(source).toContain("if (!isLoading && !isError)");
    expect(source).toContain("Try verification again");
    expect(source).toContain('Link to="/settings"');
    expect(source).toContain("Unlock with Premium");
  });
});