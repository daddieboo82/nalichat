import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
describe("admin Premium conversion reporting", () => {
  it("shows the funnel in admin only without changing billing", async () => {
    const component = await readFile("src/components/admin/PremiumConversionScorecard.jsx", "utf8");
    const panel = await readFile("src/components/admin/NaliMaintenancePanel.jsx", "utf8");
    expect(component).toContain('user?.role !== "admin"');
    expect(component).toContain('base44.entities.ActivationFunnel.list');
    expect(component).toContain('"entitlement_prompt_view"');
    expect(component).toContain('"entitlement_prompt_convert"');
    expect(component).toContain('"paywall_dismissed"');
    expect(component).toContain('"checkout_started"');
    expect(component).toContain('"purchase_completed"');
    expect(component).toContain('"purchase_failed"');
    expect(component).not.toContain("Subscription.update");
    expect(component).not.toContain("createPayPalSubscription");
    expect(panel).toContain("<PremiumConversionScorecard />");
  });
});
