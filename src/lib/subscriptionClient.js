import { base44 } from "@/api/base44Client";

export const SUBSCRIPTION_QUERY_KEY = "subscription";

export const ENTITLEMENT_KEYS = Object.freeze([
  "chat.core",
  "ai.standard",
  "ai.high_limits",
  "ai.best_model",
  "messages.schedule",
  "search.advanced",
  "files.large_upload",
  "chat.export",
  "appearance.premium_themes",
  "voice.transcription",
  "calls.summary",
  "reminders.follow_up",
  "privacy.locked_chats",
]);

const VALID_PLANS = new Set(["free", "premium", "premium_plus"]);
const VALID_STATUSES = new Set([
  "active",
  "trialing",
  "canceled",
  "ended",
  "pending",
  "unpaid",
  "incomplete",
]);
const VALID_PERIODS = new Set(["monthly", "annual"]);

function normalizeEntitlements(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.freeze(Object.fromEntries(
    ENTITLEMENT_KEYS.map((key) => [key, source[key] === true]),
  ));
}

export const FREE_SUBSCRIPTION = Object.freeze({
  plan: "free",
  status: "active",
  billingPeriod: null,
  provider: null,
  currentPeriodEnd: null,
  renewsAt: null,
  cancelAtPeriodEnd: false,
  trialStartedAt: null,
  trialEndDate: null,
  trialUsedAt: null,
  trialEligible: false,
  trialEligibilityReason: "unknown",
  grandfathered: false,
  grandfatheredFromPlan: null,
  entitlements: normalizeEntitlements({ "chat.core": true }),
  hasPaidAccess: false,
  hasPending: false,
  isTrialing: false,
});

export function normalizeSubscription(value) {
  const source = value && typeof value === "object" ? value : {};
  const plan = VALID_PLANS.has(source.plan) ? source.plan : "free";
  const status = VALID_STATUSES.has(source.status) ? source.status : "ended";
  const entitlements = normalizeEntitlements(source.entitlements);
  const hasPaidAccess = plan !== "free" && source.hasPaidAccess === true;

  return Object.freeze({
    plan,
    status,
    billingPeriod: VALID_PERIODS.has(source.billingPeriod) ? source.billingPeriod : null,
    provider: typeof source.provider === "string" ? source.provider : null,
    currentPeriodEnd: typeof source.currentPeriodEnd === "string" ? source.currentPeriodEnd : null,
    renewsAt: typeof source.renewsAt === "string" ? source.renewsAt : null,
    cancelAtPeriodEnd: source.cancelAtPeriodEnd === true,
    trialStartedAt: typeof source.trialStartedAt === "string" ? source.trialStartedAt : null,
    trialEndDate: typeof source.trialEndDate === "string" ? source.trialEndDate : null,
    trialUsedAt: typeof source.trialUsedAt === "string" ? source.trialUsedAt : null,
    trialEligible: source.trialEligible === true,
    trialEligibilityReason: typeof source.trialEligibilityReason === "string"
      ? source.trialEligibilityReason
      : "unknown",
    grandfathered: source.grandfathered === true,
    grandfatheredFromPlan: typeof source.grandfatheredFromPlan === "string"
      ? source.grandfatheredFromPlan
      : null,
    entitlements,
    hasPaidAccess,
    hasPending: source.hasPending === true,
    isTrialing: status === "trialing" && hasPaidAccess,
  });
}

export function subscriptionQueryKey(userId) {
  return [SUBSCRIPTION_QUERY_KEY, userId || "anonymous"];
}

export async function checkSubscriptionStatus(expectedUserId) {
  const response = await base44.functions.invoke("checkSubscriptionStatus");
  const payload = response?.data ?? response;
  if (
    !payload ||
    typeof payload !== "object" ||
    payload.error ||
    payload.success !== true ||
    payload.action !== "check_subscription_status" ||
    typeof payload.userId !== "string" ||
    !payload.userId.trim() ||
    (expectedUserId && payload.userId !== expectedUserId)
  ) {
    throw new Error(payload?.error || "Unable to load subscription status");
  }
  return normalizeSubscription(payload);
}

