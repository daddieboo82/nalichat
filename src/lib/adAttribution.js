const ATTRIBUTION_KEY = 'nalichat_marketing_attribution_v1';
const PARAMS = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

export function captureMarketingAttribution(search = window.location.search) {
  try {
    const params = new URLSearchParams(search);
    const captured = {};
    for (const key of PARAMS) {
      const value = params.get(key);
      if (value) captured[key] = value.slice(0, 500);
    }
    if (!Object.keys(captured).length) return null;

    const existing = getMarketingAttribution() || {};
    const record = {
      ...existing,
      ...captured,
      landing_path: existing.landing_path || window.location.pathname,
      captured_at: existing.captured_at || new Date().toISOString(),
      latest_path: window.location.pathname,
      updated_at: new Date().toISOString(),
    };
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(record));
    return record;
  } catch {
    return null;
  }
}

export function getMarketingAttribution() {
  try {
    const raw = sessionStorage.getItem(ATTRIBUTION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
