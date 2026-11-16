import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

describe("Legacy admin dashboard link", () => {
  it("redirects the former admin-dashboard URL to the real admin route", async () => {
    const routes = await readFile("src/App.jsx", "utf8");
    const notFound = await readFile("src/lib/PageNotFound.jsx", "utf8");
    const admin = await readFile("src/pages/AdminDashboard.jsx", "utf8");
    expect(routes).toContain('<Route path="/admin" element={<AdminDashboard />} />');
    expect(notFound).toContain("location.pathname.toLowerCase() === '/admin-dashboard'");
    expect(notFound).toContain("<Navigate to={'/admin' + location.search + location.hash} replace />");
    expect(admin).toContain('currentUser.role !== "admin"');
  });
});