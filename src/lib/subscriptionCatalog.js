export const BILLING_PERIODS = Object.freeze({
  monthly: { id: "monthly", label: "Monthly" },
  annual: { id: "annual", label: "Yearly" },
});

export const SUBSCRIPTION_CATALOG = Object.freeze({
  free: Object.freeze({
    id: "free",
    name: "Free",
    description: "Essential messaging for staying connected with creators and teams.",
    prices: Object.freeze({
      monthly: Object.freeze({ amount: 0, label: "$0", suffix: "forever", sku: null }),
      annual: Object.freeze({ amount: 0, label: "$0", suffix: "forever", sku: null }),
    }),
    features: Object.freeze([
      "1:1 creator messaging",
      "Group chat",
      "NaliStudio access for recording, editing, mixing, and track projects",
    ]),
  }),
  premium: Object.freeze({
    id: "premium",
    name: "Premium",
    description: "Advanced messaging, AI, file, search, voice, and customization tools for active creators.",
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
      "AI-assisted creator tools",
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
    description: "The complete NaliChat experience with the highest limits, best AI access, and advanced privacy and productivity tools.",
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
      "Higher AI usage limits",
      "Access to the best available NaliChat AI model",
      "Highest-tier AI support for Studio workflows",
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
