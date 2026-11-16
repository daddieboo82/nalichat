const VARIANTS = Object.freeze({
  A: Object.freeze({
    id: "A",
    headline: "More AI tools. More creative control. One NaliChat subscription.",
    subhead: "Premium unlocks up to 200 NALI.ai requests per day, AI-assisted Studio mastering, scheduling, advanced search, and transcription. Pay through PayPal.",
    trialCta: "Choose Premium",
    badges: Object.freeze({
      premium: "Most popular",
      premium_plus: "More AI power",
    }),
  }),
  B: Object.freeze({
    id: "B",
    headline: "Unlock the creator tools beyond free messaging and Studio.",
    subhead: "Go Premium for AI-assisted mastering, advanced messages, and NALI.ai. Choose Premium Plus for up to 1,000 daily AI requests, locked chats, and creator productivity tools.",
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
  let value;
  try { value = storage?.getItem(key); } catch { /* Storage may be blocked. */ }
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try { storage?.setItem(key, value); } catch { /* Keep the in-memory identity. */ }
  }
  return value;
}

export function assignPaywallVariant(userId, storage = globalThis.localStorage) {
  if (PAYWALL_CONFIG.variant !== "auto") {
    return PAYWALL_CONFIG.variant;
  }

  const identity = userId || anonymousIdentity(storage);
  const storageKey = `nalichat_paywall_variant:${identity}`;
  let saved;
  try { saved = storage?.getItem(storageKey); } catch { /* Storage may be blocked. */ }
  if (saved === "A" || saved === "B") {
    return saved;
  }

  const variant = stableHash(identity) % 2 === 0 ? "A" : "B";
  try { storage?.setItem(storageKey, variant); } catch { /* The variant is still usable. */ }
  return variant;
}

export function getPaywallCopy(variant) {
  return VARIANTS[variant] || VARIANTS.A;
}

