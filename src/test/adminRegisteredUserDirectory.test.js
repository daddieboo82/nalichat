import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Admin registered-user directory", () => {
  it("requires admin auth before read-only user lookup", async () => {
    const backend = await readFile("base44/functions/adminFindRegisteredUsers/entry.ts", "utf8");
    expect(backend).toContain("admin.role !== 'admin'");
    expect(backend).toContain("readJsonBodyLimited");
    expect(backend).toContain("consumeHourlyLimit");
    expect(backend).toContain("entities.User");
    expect(backend).toContain("users.filter(filter, '-created_date', PAGE_SIZE + 1");
    expect(backend).not.toContain("users.update(");
    expect(backend).not.toContain("users.create(");
  });
  it("shows a read-only searchable account list only for admins", async () => {
    const panel = await readFile("src/components/admin/NaliMaintenancePanel.jsx", "utf8");
    const directory = await readFile("src/components/admin/RegisteredUserDirectory.jsx", "utf8");
    expect(panel).toContain("<RegisteredUserDirectory />");
    expect(directory).toContain('user?.role !== "admin"');
    expect(directory).toContain('base44.functions.invoke("adminFindRegisteredUsers"');
    expect(directory).toContain("Read-only directory");
    expect(directory).toContain("Onboarding complete");
    expect(directory).toContain("Next page");
  });
});