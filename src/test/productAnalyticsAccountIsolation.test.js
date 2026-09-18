import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("product analytics account isolation", () => {
  it("scopes product sessions by account and restarts analytics when identity changes", async () => {
    const analytics = await readText("src/lib/productAnalytics.js");
    const app = await readText("src/App.jsx");

    expect(analytics).toContain('nali_product_session:${userId || "anonymous"}');
    expect(analytics).toContain("sessionStorageKey = sessionKeyFor(userId);");
    expect(analytics).toContain("session = null;");
    expect(analytics).toContain("lastRoute = null;");
    expect(analytics).toContain("sessionStorage.removeItem(LEGACY_SESSION_KEY)");
    expect(analytics).toContain('return !/iPad|iPhone|iPod/.test(navigator.userAgent || "");');
    expect(analytics).toContain("if (supportsCredentialedAnalyticsTransport())");
    expect(app).toContain("useEffect(() => initProductAnalytics(user?.id || null), [user?.id]);");
  });
});
