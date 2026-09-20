export const BILLING_PERIODS = Object.freeze({
  monthly: { id: "monthly", label: "Monthly" },
  annual: { id: "annual", label: "Yearly" },
});

export const SUBSCRIPTION_CATALOG = Object.freeze({
  free: Object.freeze({
    id: "free",
    name: "Free",
    description: "Start creating with core messaging, Studio, and generous file uploads at no cost.",
    prices: Object.freeze({
      monthly: Object.freeze({ amount: 0, label: "$0", suffix: "forever", sku: null }),
      annual: Object.freeze({ amount: 0, label: "$0", suffix: "forever", sku: null }),
    }),
    features: Object.freeze([
      "Direct and group creator messaging",
      "File sharing and uploads up to 2 GB per file",
      "NaliStudio access for recording, editing, mixing, and track projects",
    ]),
  }),
  premium: Object.freeze({
    id: "premium",
    name: "Premium",
    description: "For active creators who want NALI.ai, larger file transfers, and advanced messaging tools.",
    prices: Object.freeze({
      monthly: Object.freeze({
        amount: 7.99,
        label: "$7.99",
        suffix: "/month",
        sku: "premium_monthly",
      }),
      annual: Object.freeze({
        amount: 59.99,
        label: "$59.99",
        suffix: "/year",
        sku: "premium_yearly",
      }),
    }),
    features: Object.freeze([
      "Everything in Free",
      "Premium file transfer tools",
      "NALI.ai creator assistance - up to 200 requests per UTC day",
      "AI-assisted Studio mastering and export tools",
      "Schedule messages",
      "Advanced message search",
      "Export chat content",
      "Premium chat themes",
      "Voice transcription",
    ]),
  }),
  premium_plus: Object.freeze({
    id: "premium_plus",
    name: "Premium Plus",
    description: "For power creators who want the highest file limits, strongest AI access, privacy, and productivity tools.",
    prices: Object.freeze({
      monthly: Object.freeze({
        amount: 14.99,
        label: "$14.99",
        suffix: "/month",
        sku: "premium_plus_monthly",
      }),
      annual: Object.freeze({
        amount: 99.99,
        label: "$99.99",
        suffix: "/year",
        sku: "premium_plus_yearly",
      }),
    }),
    features: Object.freeze([
      "Everything in Premium",
      "Premium file transfer tools with resumable transfers",
      "Highest AI limit - up to 1,000 requests per UTC day",
      "Best available NaliChat AI model and highest-tier Studio AI support",
      "AI call summaries",
      "Follow-up reminders",
      "Locked chats for extra privacy",
    ]),
  }),
});

export const PAID_PLAN_IDS = Object.freeze(["premium", "premium_plus"]);

export function annualSavings(planId) {
  const plan = SUBSCRIPTION_CATALOG[planId];
  if (!plan || planId === "free") return 0;
  return Math.round((plan.prices.monthly.amount * 12) - plan.prices.annual.amount);
}

export function subscriptionSku(planId, billingPeriod) {
  return SUBSCRIPTION_CATALOG[planId]?.prices?.[billingPeriod]?.sku || null;
}
