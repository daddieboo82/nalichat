const VARIANTS = Object.freeze({
  A: Object.freeze({
    id: "A",
    headline: "Finish more music with everything in one place.",
    subhead: "Upgrade when you’re ready for more NALI.ai, bigger creative transfers, advanced Studio workflows, and premium creator tools.",
    trialCta: "Choose Premium",
    badges: Object.freeze({
      premium: "Most popular",
      premium_plus: "Best value",
    }),
  }),
  B: Object.freeze({
    id: "B",
    headline: "Turn ideas into finished releases faster.",
    subhead: "Keep your conversations, sessions, files, and AI-assisted creator workflow together—then unlock more power when you need it.",
    trialCta: "Choose Premium",
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

