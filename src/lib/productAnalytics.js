import { base44 } from "@/api/base44Client";

const LEGACY_SESSION_KEY = "nali_product_session";
const sessionKeyFor = (userId) => `nali_product_session:${userId || "anonymous"}`;
let sessionStorageKey = sessionKeyFor(null);
const FLUSH_INTERVAL_MS = 15_000;
let initialized = false;
let session = null;
let flushTimer = null;
let lastRoute = null;

function now() { return Date.now(); }
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
function track(name, properties = {}) {
  try {
    const result = base44.analytics?.track?.({ eventName: name, properties: { ...properties, product_session_id: ensureSession().id } });
    if (result?.catch) result.catch(() => {});
  } catch {}
}
function markActive() {
  const s = ensureSession();
  const t = now();
  if (document.visibilityState === "visible" && t - s.lastActiveAt < 60_000) s.engagedMs += Math.max(0, t - s.lastActiveAt);
  s.lastActiveAt = t;
  safeSet(s);
}
function flush(reason = "heartbeat") {
  markActive();
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
export function initProductAnalytics(userId = null) {
  if (initialized || typeof window === "undefined") return () => {};
  sessionStorageKey = sessionKeyFor(userId);
  session = null;
  lastRoute = null;
  initialized = true;
  const s = ensureSession();
  track("product_session_started", { route: window.location.pathname, returning_tab_session: s.startedAt !== s.lastActiveAt });
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
  const onVisibility = () => { if (document.visibilityState === "hidden") flush("hidden"); else markActive(); };
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
    initialized = false;
  };
}
