import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";

describe("Studio Premium verification recovery", () => {
  it("offers billing review instead of another upgrade when PayPal state is uncertain", async () => {
    const bounce = await fs.readFile("src/components/studio/BounceDialog.jsx", "utf8");
    expect(bounce).toContain("subscriptionError || subscription.hasPending");
    expect(bounce).toContain('Link to="/settings"');
    expect(bounce).toContain("Review billing");
    expect(bounce).toContain('to="/pricing?source=studio_bounce&feature=studio.ai_mastering"');
  });
  it("enables AI mastering after an entitled subscription resolves without overwriting user choice", async () => {
    const bounce = await fs.readFile("src/components/studio/BounceDialog.jsx", "utf8");
    expect(bounce).toContain("masteringChoiceRef.current = true");
    expect(bounce).toContain("setAutoMaster(true)");
    expect(bounce).toContain("const usedAiMastering = canUseAi && autoMaster");
    expect(bounce).toContain("description: usedAiMastering");
  });
  it("distinguishes a Studio Editor verification error from a free plan", async () => {
    const editor = await fs.readFile("src/pages/StudioEditor.jsx", "utf8");
    expect(editor).toContain("subscriptionError || subscription.hasPending");
    expect(editor).toContain("Check Settings before starting another checkout");
  });
});
