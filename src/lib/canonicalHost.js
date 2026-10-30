export const CANONICAL_ORIGIN = "https://nalichat.org";

// Hosts that still serve this app after the public site moved to nalichat.org.
// Traffic is redirected there so checkout, login, and PayPal return URLs share
// one origin. Preview, sandbox, and localhost stay put for development.
const LEGACY_HOSTS = new Set([
  "nalichat.base44.app",
  "www.nalichat.org",
]);

export function legacyHostRedirectTarget(href) {
  let current;
  try {
    current = new URL(href);
  } catch {
    return null;
  }
  if (!LEGACY_HOSTS.has(current.hostname.toLowerCase())) return null;
  return new URL(
    `${current.pathname}${current.search}${current.hash}`,
    CANONICAL_ORIGIN,
  ).toString();
}

export function redirectLegacyHost(location) {
  const target = legacyHostRedirectTarget(location?.href);
  if (!target || typeof location?.replace !== "function") return false;
  location.replace(target);
  return true;
}
