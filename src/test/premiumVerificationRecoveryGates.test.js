import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Paid feature gates distinguish verification failures from free users", () => {
  it("does not route an unknown paid status directly to another checkout", async () => {
    const gate = await readFile("src/components/subscription/EntitlementGate.jsx", "utf8");
    expect(gate).toContain("if (isEntitled) return children");
    expect(gate).toContain("isError ? (");
    expect(gate).toContain('Link to="/settings"');
    expect(gate).toContain("refetch()");
    expect(gate).toContain("Unlock with Premium");
    expect(gate).toContain("trackPaywallEvent");
  });

  it("keeps follow-up reminders locked but offers billing recovery on verification errors", async () => {
    const dialog = await readFile("src/components/messages/FollowUpReminderDialog.jsx", "utf8");
    expect(dialog).toContain("subscription.isError ? (");
    expect(dialog).toContain("subscription.refetch()");
    expect(dialog).toContain('Link to="/settings"');
    expect(dialog).toContain("Unlock follow-up reminders");
    expect(dialog).toContain('subscription.hasEntitlement("reminders.follow_up")');
  });
});
