import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { eventIdentity, summarizePremiumEvents, recoveredCheckoutCustomers } from "@/components/admin/PremiumConversionScorecard";
describe("admin Premium conversion reporting", () => {
  it("counts repeated failures from the same customer as one identified user", () => {
    const events = [
      { id: "e1", event_name: "purchase_failed", metadata: { user_id: "customer-1" }, created_date: "2026-11-15T10:00:00Z" },
      { id: "e2", event_name: "purchase_failed", metadata: { user_id: "customer-1" }, created_date: "2026-11-15T10:01:00Z" },
      { id: "e3", event_name: "purchase_completed", user_id: "customer-1", created_date: "2026-11-15T10:02:00Z" },
    ];
    expect(eventIdentity(events[0])).toBe("user:customer-1");
    expect(summarizePremiumEvents(events, "purchase_failed")).toEqual({ attempts: 2, identities: 1, knownCustomers: 1 });
    expect(recoveredCheckoutCustomers(events)).toBe(1);
  });

  it("keeps anonymous sessions distinct and ignores purchases preceding checkout errors", () => {
    const events = [
      { id: "e1", event_name: "purchase_failed", session_id: "s1" },
      { id: "e2", event_name: "purchase_failed", session_id: "s2" },
      { id: "e3", event_name: "purchase_completed", user_id: "customer-1", created_date: "2026-11-15T10:00:00Z" },
      { id: "e4", event_name: "purchase_failed", user_id: "customer-1", created_date: "2026-11-15T10:02:00Z" },
    ];
    expect(summarizePremiumEvents(events, "purchase_failed")).toEqual({ attempts: 3, identities: 3, knownCustomers: 1 });
    expect(recoveredCheckoutCustomers(events)).toBe(0);
  });

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
