import { base44 } from "@/api/base44Client";

const LEGACY_SESSION_KEY = "nali_product_session";
const sessionKeyFor = (userId) => `nali_product_session:${userId || "anonymous"}`;
let sessionStorageKey = sessionKeyFor(null);
const FLUSH_INTERVAL_MS = 15_000;
const RETURN_VISIT_KEY = "nali_product_last_visit_date";
const ACQUISITION_KEY = "nali_product_acquisition";
let initialized = false;
let session = null;
let flushTimer = null;
let lastRoute = null;
let foregroundSince = null;

function now() { return Date.now(); }
function supportsCredentialedAnalyticsTransport() {
  if (typeof navigator === "undefined") return false;
  // Base44's analytics batch endpoint currently responds with a wildcard
  // origin while using credentials. WebKit rejects that combination, so keep
  // product analytics non-blocking on iPhone/iPad until the endpoint supplies
  // an explicit origin. Funnel events below continue to use app entities.
  return !/iPad|iPhone|iPod/.test(navigator.userAgent || "");
}
function safeGet() {
  try {
    const saved = sessionStorage.getItem(sessionStorageKey);
    if (saved) return JSON.parse(saved);
    if (sessionStorageKey === sessionKeyFor(null)) {
      const legacy = sessionStorage.getItem(LEGACY_SESSION_KEY);
      if (legacy) {
        sessionStorage.setItem(sessionStorageKey, legacy);
        sessionStorage.removeItem(LEGACY_SESSION_KEY);
        return JSON.parse(legacy);
      }
    }
  } catch {}
  return null;
}
function safeSet(value) { try { sessionStorage.setItem(sessionStorageKey, JSON.stringify(value)); } catch {} }
function newSession() {
  const startedAt = now();
  return { id: crypto.randomUUID?.() || `${startedAt}-${Math.random().toString(36).slice(2)}`, startedAt, lastActiveAt: startedAt, engagedMs: 0 };
}
function ensureSession() {
  session = safeGet() || newSession();
  safeSet(session);
  return session;
}
function getAcquisition() {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(ACQUISITION_KEY);
    if (saved) return JSON.parse(saved);
    const params = new URLSearchParams(window.location.search);
    const referrer = document.referrer || "";
    let referrerHost = "";
    try { referrerHost = referrer ? new URL(referrer).hostname.replace(/^www\./, "") : ""; } catch {}
    const acquisition = {
      campaign_source: params.get("utm_source") || referrerHost || "direct",
      campaign_medium: params.get("utm_medium") || (referrerHost ? "referral" : "direct"),
      campaign_name: params.get("utm_campaign") || "",
      campaign_content: params.get("utm_content") || "",
      campaign_term: params.get("utm_term") || "",
      landing_path: window.location.pathname,
      referrer: referrer,
      first_touch_at: new Date().toISOString(),
    };
    localStorage.setItem(ACQUISITION_KEY, JSON.stringify(acquisition));
    return acquisition;
  } catch { return {}; }
}
function track(name, properties = {}) {
  const currentSession = ensureSession();
  const acquisition = getAcquisition();
  const enrichedProperties = {
    ...acquisition,
    ...properties,
    campaign_source: properties.campaign_source || acquisition.campaign_source || "",
    campaign_medium: properties.campaign_medium || acquisition.campaign_medium || "",
    campaign_name: properties.campaign_name || acquisition.campaign_name || "",
  };
  if (supportsCredentialedAnalyticsTransport()) {
    try {
      const result = base44.analytics?.track?.({ eventName: name, properties: { ...enrichedProperties, product_session_id: currentSession.id } });
      if (result?.catch) result.catch(() => {});
    } catch {}
  }
  const funnelEvents = new Set([
    "homepage_view", "homepage_demo_click", "signup_click", "registration_view", "registration_started",
    "registration_completed", "registration_failed", "otp_resend_success", "onboarding_complete", "post_login_action", "messenger_discovery_view",
    "contact_added", "messenger_discovery_message_click", "first_message", "studio_open", "first_upload", "activation_complete", "return_visit",
    "upgrade_click", "paywall_view", "paywall_tier_select", "paywall_primary_cta", "checkout_started", "purchase_completed", "purchase_failed"
  ]);
  if (funnelEvents.has(name)) {
    try {
      const record = {
        event_name: name,
        source: enrichedProperties.source || "product",
        session_id: currentSession.id,
        user_id: enrichedProperties.user_id || "",
        route: enrichedProperties.route || window.location.pathname,
        campaign_source: enrichedProperties.campaign_source || "",
        campaign_medium: enrichedProperties.campaign_medium || "",
        campaign_name: enrichedProperties.campaign_name || "",
        metadata: enrichedProperties,
      };
      const saved = base44.entities.ActivationFunnel.create(record);
      if (saved?.catch) saved.catch(() => {});
    } catch {}
  }
}
function accrueForegroundUntil(t = now()) {
  const s = ensureSession();
  if (foregroundSince != null) {
    s.engagedMs += Math.max(0, t - foregroundSince);
  }
  foregroundSince = document.visibilityState === "visible" ? t : null;
  s.lastActiveAt = t;
  safeSet(s);
}
function markActive() {
  const t = now();
  if (document.visibilityState === "visible") {
    if (foregroundSince == null) foregroundSince = t;
    const s = ensureSession();
    s.lastActiveAt = t;
    safeSet(s);
    return;
  }
  const s = ensureSession();
  s.lastActiveAt = t;
  safeSet(s);
}
function flush(reason = "heartbeat") {
  accrueForegroundUntil();
  const s = ensureSession();
  track("product_session_engagement", {
    reason,
    engaged_seconds: Math.round(s.engagedMs / 1000),
    elapsed_seconds: Math.round((now() - s.startedAt) / 1000),
    route: window.location.pathname,
    visibility: document.visibilityState,
  });
}
export function trackProductEvent(name, properties = {}) { track(name, properties); }

export function markActivationComplete(userId, source, properties = {}) {
  if (!userId) return false;
  const key = `nali_activation_complete:${userId}`;
  try {
    if (localStorage.getItem(key) === "1") return false;
    localStorage.setItem(key, "1");
  } catch {}
  track("activation_complete", {
    user_id: userId,
    source: source || "product",
    activation_source: source || "product",
    ...properties,
  });
  return true;
}

export function initProductAnalytics(userId = null) {
  if (initialized || typeof window === "undefined") return () => {};
  sessionStorageKey = sessionKeyFor(userId);
  session = null;
  lastRoute = null;
  foregroundSince = document.visibilityState === "visible" ? now() : null;
  initialized = true;
  const s = ensureSession();
  track("product_session_started", { route: window.location.pathname, returning_tab_session: s.startedAt !== s.lastActiveAt });
  try {
    const today = new Date().toISOString().slice(0, 10);
    const lastVisitDate = localStorage.getItem(RETURN_VISIT_KEY);
    if (lastVisitDate && lastVisitDate !== today) {
      track("return_visit", { previous_visit_date: lastVisitDate, route: window.location.pathname });
    }
    localStorage.setItem(RETURN_VISIT_KEY, today);
  } catch {}
  const routeCheck = () => {
    const route = window.location.pathname + window.location.search;
    if (route !== lastRoute) {
      lastRoute = route;
      track("product_page_view", { route: window.location.pathname, search: window.location.search });
    }
  };
  routeCheck();
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  history.pushState = function(...args) { const r = originalPush.apply(this, args); routeCheck(); return r; };
  history.replaceState = function(...args) { const r = originalReplace.apply(this, args); routeCheck(); return r; };
  const onPop = () => routeCheck();
  const onActivity = () => markActive();
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      // visibilitychange fires after the state flips, so close the foreground
      // interval explicitly instead of relying on the current visibility state.
      const t = now();
      const s = ensureSession();
      if (foregroundSince != null) s.engagedMs += Math.max(0, t - foregroundSince);
      foregroundSince = null;
      s.lastActiveAt = t;
      safeSet(s);
      track("product_session_engagement", {
        reason: "hidden",
        engaged_seconds: Math.round(s.engagedMs / 1000),
        elapsed_seconds: Math.round((t - s.startedAt) / 1000),
        route: window.location.pathname,
        visibility: document.visibilityState,
      });
    } else {
      foregroundSince = now();
      markActive();
    }
  };
  const onPageHide = () => flush("pagehide");
  window.addEventListener("popstate", onPop);
  window.addEventListener("pointerdown", onActivity, { passive: true });
  window.addEventListener("keydown", onActivity, { passive: true });
  window.addEventListener("scroll", onActivity, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", onPageHide);
  flushTimer = window.setInterval(() => flush("heartbeat"), FLUSH_INTERVAL_MS);
  return () => {
    flush("cleanup");
    clearInterval(flushTimer);
    window.removeEventListener("popstate", onPop);
    window.removeEventListener("pointerdown", onActivity);
    window.removeEventListener("keydown", onActivity);
    window.removeEventListener("scroll", onActivity);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    history.pushState = originalPush;
    history.replaceState = originalReplace;
    foregroundSince = null;
    initialized = false;
  };
}
