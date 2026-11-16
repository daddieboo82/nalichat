import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";

describe("Studio mastering export Premium recovery", () => {
  it("keeps Premium-only mastering guarded and offers billing recovery when status cannot be verified", async () => {
    const source = await fs.readFile("src/components/studio/ExportBounce.jsx", "utf8");
    expect(source).toContain('const canMaster = hasEntitlement("ai.standard")');
    expect(source).toContain("if (!canMaster) {");
    expect(source).toContain("subscriptionError || subscription.hasPending");
    expect(source).toContain('Link to="/settings"');
    expect(source).toContain("Retry verification");
    expect(source).toContain("(!canMaster && !billingReviewNeeded)");
    expect(source).toContain('disabled={disabled || !postId || subscriptionLoading');
  });
});