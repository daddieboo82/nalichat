import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("PayPal donation admin read-only audit", () => {
  it("limits donor record and provider status reads to admins", async () => {
    const backend = await readFile("base44/functions/getPayPalDonationAudit/entry.ts", "utf8");
    expect(backend).toContain("admin.role !== 'admin'");
    expect(backend).toContain("consumeHourlyLimit");
    expect(backend).toContain("PayPalDonation.filter");
    expect(backend).toContain("'GET'");
    expect(backend).not.toContain("PayPalDonation.update(");
    expect(backend).not.toContain("PayPalDonation.create(");
    expect(backend).not.toContain("'/capture'");
    expect(backend).toContain("readOnly: true");
    expect(backend).toContain("status === 'approved_not_captured'");
    expect(backend).toContain("status === 'provider_unavailable'");
    expect(backend).toContain("status === 'order_not_found'");
    expect(backend).toContain("(record.status === 'paid') !== (status === 'provider_paid')");
  });

  it("shows admin-only donation audit with recorded and provider statuses", async () => {
    const component = await readFile("src/components/admin/PayPalDonationAudit.jsx", "utf8");
    const panel = await readFile("src/components/admin/NaliMaintenancePanel.jsx", "utf8");
    expect(component).toContain('user?.role !== "admin"');
    expect(component).toContain('base44.functions.invoke("getPayPalDonationAudit"');
    expect(component).toContain("PayPal API authentication");
    expect(component).toContain("Provider capture");
    expect(component).toContain("No PayPal donation orders have been recorded");
    expect(component).toContain("approved by PayPal but have no confirmed capture");
    expect(panel).toContain("<PayPalDonationAudit />");
  });
});