export const BILLING_PERIODS = Object.freeze({
  monthly: { id: "monthly", label: "Monthly" },
  annual: { id: "annual", label: "Yearly" },
});

export const SUBSCRIPTION_CATALOG = Object.freeze({
  free: Object.freeze({
    id: "free",
    name: "Free",
    description: "Core messaging for everyone.",
    prices: Object.freeze({
      monthly: Object.freeze({ amount: 0, label: "$0", suffix: "forever", sku: null }),
      annual: Object.freeze({ amount: 0, label: "$0", suffix: "forever", sku: null }),
    }),
    features: Object.freeze([
      "Core 1:1 chat",
      "Core group chat",
    ]),
  }),
  premium: Object.freeze({
    id: "premium",
    name: "Premium",
    description: "More power for everyday messaging and creative work.",
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
      "Large file uploads up to 20GB",
      "More Premium capabilities coming later",
    ]),
  }),
  premium_plus: Object.freeze({
    id: "premium_plus",
    name: "Premium Plus",
    description: "The highest NaliChat tier for power users.",
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
      "More Premium Plus capabilities coming later",
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
