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
    expect(analytics).toContain('"product_session_started", "product_session_engagement"');
    expect(analytics).toContain('"login_started", "login_completed", "login_failed"');
    expect(analytics).toContain('user_id: properties.user_id || analyticsUserId || ""');
    expect(analytics).toContain('name !== "product_session_engagement" || properties.reason !== "heartbeat"');
    expect(analytics).toContain("base44.appLogs.logUserInApp(pageName)");
    expect(analytics).toContain('name === "product_page_view"');
    expect(analytics).toContain('Math.round((s.engagedMs / 1000) * 10) / 10');
    expect(app).toContain("useEffect(() => initProductAnalytics(user?.id || null), [user?.id]);");
    expect(app).toContain("trackProductEvent('login_completed'");
    expect(app).toContain("duration_ms: durationMs");
    expect(app).toContain("duration_seconds: Math.max(0.1");
    const loginSource = await readText("src/pages/Login.jsx");
    expect(loginSource).toContain('trackProductEvent("login_started"');
    expect(loginSource).toContain('trackProductEvent("login_failed"');
    expect(loginSource).toContain("login_pending_started_at");
    const login = await readText("src/pages/Login.jsx");
    expect(login).toContain('sessionStorage.setItem("login_pending_method", "email_password")');
    expect(login).toContain('sessionStorage.setItem("login_pending_method", "google_oauth")');
  });
});
