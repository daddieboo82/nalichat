export const SUBSCRIPTION_PLANS = ['free', 'premium', 'premium_plus'] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_STATUSES = [
  'active',
  'trialing',
  'canceled',
  'ended',
  'pending',
  'unpaid',
  'incomplete',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_PERIODS = ['monthly', 'annual'] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number];

export const BILLING_PROVIDERS = ['stripe', 'paypal', 'wix', 'manual', 'apple', 'unknown'] as const;
export type BillingProvider = (typeof BILLING_PROVIDERS)[number];

export const ENTITLEMENT_KEYS = [
  'chat.core',
  'ai.standard',
  'ai.high_limits',
  'ai.best_model',
  'messages.schedule',
  'search.advanced',
  'files.large_upload',
  'chat.export',
  'appearance.premium_themes',
  'voice.transcription',
  'calls.summary',
  'reminders.follow_up',
  'privacy.locked_chats',
] as const;
export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];
export type Entitlements = Record<EntitlementKey, boolean>;

export interface ResolveEntitlementLimits {
  currentPeriodEnd?: string | null;
  trialEndDate?: string | null;
  now?: string | Date;
}

const GIB = 1024 * 1024 * 1024;

export interface SubscriptionLimits {
  ai: { requestsPerUtcDay: number };
  upload: { maxBytes: number };
}

export const PLAN_LIMITS: Readonly<Record<SubscriptionPlan, SubscriptionLimits>> = {
  free: {
    ai: { requestsPerUtcDay: 20 },
    upload: { maxBytes: 2 * GIB },
  },
  premium: {
    ai: { requestsPerUtcDay: 200 },
    upload: { maxBytes: 10 * GIB },
  },
  premium_plus: {
    ai: { requestsPerUtcDay: 1_000 },
    upload: { maxBytes: 20 * GIB },
  },
};

const FREE_ENTITLEMENTS = ['chat.core'] as const satisfies readonly EntitlementKey[];

const PREMIUM_ENTITLEMENTS = [
  ...FREE_ENTITLEMENTS,
  'ai.standard',
  'messages.schedule',
  'search.advanced',
  'files.large_upload',
  'chat.export',
  'appearance.premium_themes',
  'voice.transcription',
] as const satisfies readonly EntitlementKey[];

const PREMIUM_PLUS_ENTITLEMENTS = [
  ...PREMIUM_ENTITLEMENTS,
  'ai.high_limits',
  'ai.best_model',
  'calls.summary',
  'reminders.follow_up',
  'privacy.locked_chats',
] as const satisfies readonly EntitlementKey[];

const PLAN_ENTITLEMENTS: Record<SubscriptionPlan, readonly EntitlementKey[]> = {
  free: FREE_ENTITLEMENTS,
  premium: PREMIUM_ENTITLEMENTS,
  premium_plus: PREMIUM_PLUS_ENTITLEMENTS,
};

export function normalizePlan(plan: unknown): SubscriptionPlan {
  if (plan === 'premium' || plan === 'premium_plus' || plan === 'free') {
    return plan;
  }
  if (plan === 'pro' || plan === 'pro_filesharing') {
    return 'premium_plus';
  }
  // Legacy trial records did not capture a target tier, so Premium is the safe default.
  if (plan === 'trial') {
    return 'premium';
  }
  return 'free';
}

export function normalizeStatus(status: unknown): SubscriptionStatus {
  if (status === 'trial') {
    return 'trialing';
  }
  if (
    status === 'active'
    || status === 'trialing'
    || status === 'canceled'
    || status === 'ended'
    || status === 'pending'
    || status === 'unpaid'
    || status === 'incomplete'
  ) {
    return status;
  }
  return 'ended';
}

export function hasPaidTierAccess(
  status: SubscriptionStatus,
  limits: ResolveEntitlementLimits = {},
): boolean {
  if (status === 'active') {
    if (!limits.currentPeriodEnd) return true;
    const now = limits.now instanceof Date
      ? limits.now.getTime()
      : Date.parse(limits.now ?? new Date().toISOString());
    const periodEnd = Date.parse(limits.currentPeriodEnd);
    return Number.isFinite(periodEnd) && Number.isFinite(now) && periodEnd > now;
  }
  if (status !== 'trialing' && status !== 'canceled') {
    return false;
  }

  const now = limits.now instanceof Date
    ? limits.now.getTime()
    : Date.parse(limits.now ?? new Date().toISOString());
  const accessEnd = status === 'trialing' ? limits.trialEndDate : limits.currentPeriodEnd;
  if (status === 'trialing' && !accessEnd) {
    return true;
  }
  if (!accessEnd) {
    return false;
  }
  const periodEnd = Date.parse(accessEnd);

  return Number.isFinite(periodEnd) && Number.isFinite(now) && periodEnd > now;
}

/**
 * Preserve intentionally non-expiring manual grants, but a PayPal ACTIVE
 * record with no future billing boundary is not verified paid access.
 * This is the access-control status only, not a mutation of provider state.
 */
export function entitlementStatusForProvider(
  provider: unknown,
  status: SubscriptionStatus,
  currentPeriodEnd: unknown,
  now = new Date().toISOString(),
): SubscriptionStatus {
  if (provider !== 'paypal' || status !== 'active') return status;
  const endMs = typeof currentPeriodEnd === 'string' ? Date.parse(currentPeriodEnd) : Number.NaN;
  const nowMs = Date.parse(now);
  return Number.isFinite(endMs) && Number.isFinite(nowMs) && endMs > nowMs
    ? status
    : 'ended';
}

/**
 * A pending PayPal billing agreement, or a previously active PayPal
 * subscription with an unverified current period, must be reconciled before
 * opening a different provider's recurring checkout. This checkout guard
 * cannot prove cross-request atomicity and does not grant paid access.
 */
export function requiresExistingPayPalCheckoutReview(
  provider: unknown,
  plan: unknown,
  status: unknown,
  currentPeriodEnd: unknown,
  now = new Date().toISOString(),
): boolean {
  if (provider !== 'paypal') return false;
  const currentStatus = normalizeStatus(status);
  // A PayPal agreement with missing or malformed local tier metadata still
  // needs provider verification before another provider begins recurring
  // billing. An asserted local "free" tier is not proof of no PayPal charge.
  if (normalizePlan(plan) === 'free' &&
      (currentStatus === 'active' || currentStatus === 'pending' ||
       currentStatus === 'incomplete' || currentStatus === 'unpaid')) return true;
  // An unresolved approval can still become billable at PayPal. Until its
  // lifecycle is verified, do not allow a parallel Stripe/Wix agreement.
  if (currentStatus === 'pending' || currentStatus === 'incomplete' || currentStatus === 'unpaid') return true;
  if (currentStatus !== 'active') return false;
  const boundary = typeof currentPeriodEnd === 'string' ? Date.parse(currentPeriodEnd) : Number.NaN;
  const nowMs = Date.parse(now);
  return !Number.isFinite(boundary) || !Number.isFinite(nowMs) || boundary <= nowMs;
}

export function resolveEntitlements(
  plan: SubscriptionPlan,
  status: SubscriptionStatus,
  limits: ResolveEntitlementLimits = {},
): Entitlements {
  const effectivePlan = plan !== 'free' && hasPaidTierAccess(status, limits) ? plan : 'free';
  const granted = new Set<EntitlementKey>(PLAN_ENTITLEMENTS[effectivePlan]);

  return {
    'chat.core': granted.has('chat.core'),
    'ai.standard': granted.has('ai.standard'),
    'ai.high_limits': granted.has('ai.high_limits'),
    'ai.best_model': granted.has('ai.best_model'),
    'messages.schedule': granted.has('messages.schedule'),
    'search.advanced': granted.has('search.advanced'),
    'files.large_upload': granted.has('files.large_upload'),
    'chat.export': granted.has('chat.export'),
    'appearance.premium_themes': granted.has('appearance.premium_themes'),
    'voice.transcription': granted.has('voice.transcription'),
    'calls.summary': granted.has('calls.summary'),
    'reminders.follow_up': granted.has('reminders.follow_up'),
    'privacy.locked_chats': granted.has('privacy.locked_chats'),
  };
}

export function resolveSubscriptionLimits(
  plan: SubscriptionPlan,
  status: SubscriptionStatus,
  accessLimits: ResolveEntitlementLimits = {},
): SubscriptionLimits {
  const effectivePlan = plan !== 'free' && hasPaidTierAccess(status, accessLimits)
    ? plan
    : 'free';
  const limits = PLAN_LIMITS[effectivePlan];
  return {
    ai: { requestsPerUtcDay: limits.ai.requestsPerUtcDay },
    upload: { maxBytes: limits.upload.maxBytes },
  };
}