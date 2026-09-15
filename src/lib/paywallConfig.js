const VARIANTS = Object.freeze({
  A: Object.freeze({
    id: "A",
    headline: "Create more. Connect better.",
    subhead: "Messaging and Studio stay useful on Free. Upgrade when you want stronger AI, creator tools, higher limits, and advanced privacy.",
    trialCta: "Start 7-day free trial",
    badges: Object.freeze({
      premium: "Most popular",
      premium_plus: "Best value",
    }),
  }),
  B: Object.freeze({
    id: "B",
    headline: "Turn NaliChat into your creator command center.",
    subhead: "Start free, then unlock advanced AI, Studio workflows, productivity tools, and premium privacy when you need more power.",
    trialCta: "Try Premium free",
    badges: Object.freeze({
      premium: "Best for everyday",
      premium_plus: "Power users",
    }),
  }),
});

const enabledValue = String(import.meta.env.VITE_PAYWALL_ENABLED ?? "true").toLowerCase();
const configuredVariant = String(import.meta.env.VITE_PAYWALL_VARIANT ?? "auto").toUpperCase();

export const PAYWALL_CONFIG = Object.freeze({
  enabled: !["0", "false", "off", "disabled"].includes(enabledValue),
  variant: configuredVariant === "A" || configuredVariant === "B" ? configuredVariant : "auto",
});

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function anonymousIdentity(storage) {
  const key = "nalichat_paywall_anonymous_id";
  let value = storage?.getItem(key);
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    storage?.setItem(key, value);
  }
  return value;
}

export function assignPaywallVariant(userId, storage = globalThis.localStorage) {
  if (PAYWALL_CONFIG.variant !== "auto") {
    return PAYWALL_CONFIG.variant;
  }

  const identity = userId || anonymousIdentity(storage);
  const storageKey = `nalichat_paywall_variant:${identity}`;
  const saved = storage?.getItem(storageKey);
  if (saved === "A" || saved === "B") {
    return saved;
  }

  const variant = stableHash(identity) % 2 === 0 ? "A" : "B";
  storage?.setItem(storageKey, variant);
  return variant;
}

export function getPaywallCopy(variant) {
  return VARIANTS[variant] || VARIANTS.A;
}

