import type {
  BillingPeriod,
  SubscriptionPlan,
  SubscriptionStatus,
} from './subscription.ts';

export const STRIPE_SKUS = [
  'premium_monthly',
  'premium_yearly',
  'premium_plus_monthly',
  'premium_plus_yearly',
] as const;
export type StripeSku = (typeof STRIPE_SKUS)[number];

export interface StripeSkuConfig {
  sku: StripeSku;
  plan: Exclude<SubscriptionPlan, 'free'>;
  billingPeriod: BillingPeriod;
  priceId: string;
}

export interface TrialBearingRecord {
  status?: unknown;
  trial_started_at?: unknown;
  trial_end_date?: unknown;
  trial_used_at?: unknown;
}

export interface StripeSubscriptionSnapshot {
  id: string;
  status: string;
  current_period_end?: number | null;
  cancel_at_period_end?: boolean | null;
  trial_start?: number | null;
  trial_end?: number | null;
}

export interface StripeSubscriptionUpdate {
  status: SubscriptionStatus;
  stripe_subscription_status: string;
  cancel_at_period_end: boolean;
  current_period_end?: string;
  trial_started_at?: string;
  trial_end_date?: string;
}

export const CHECKOUT_SUCCESS_DESTINATIONS = {
  subscription_thank_you: '/ThankYou',
} as const;

export const CHECKOUT_CANCEL_DESTINATIONS = {
  pricing: '/pricing',
  download: '/download',
} as const;

export const PORTAL_RETURN_DESTINATIONS = {
  pricing: '/pricing',
  settings: '/settings',
  download: '/download',
} as const;

type EnvironmentReader = (name: string) => string | undefined;

const SKU_DEFINITIONS: Record<
  StripeSku,
  Omit<StripeSkuConfig, 'sku' | 'priceId'> & { priceEnvironmentVariable: string }
> = {
  premium_monthly: {
    plan: 'premium',
    billingPeriod: 'monthly',
    priceEnvironmentVariable: 'STRIPE_PRICE_PREMIUM_MONTHLY',
  },
  premium_yearly: {
    plan: 'premium',
    billingPeriod: 'annual',
    priceEnvironmentVariable: 'STRIPE_PRICE_PREMIUM_YEARLY',
  },
  premium_plus_monthly: {
    plan: 'premium_plus',
    billingPeriod: 'monthly',
    priceEnvironmentVariable: 'STRIPE_PRICE_PREMIUM_PLUS_MONTHLY',
  },
  premium_plus_yearly: {
    plan: 'premium_plus',
    billingPeriod: 'annual',
    priceEnvironmentVariable: 'STRIPE_PRICE_PREMIUM_PLUS_YEARLY',
  },
};

function isStripeSku(value: unknown): value is StripeSku {
  return typeof value === 'string' && STRIPE_SKUS.includes(value as StripeSku);
}

function configuredPriceId(name: string, readEnvironment: EnvironmentReader): string {
  const value = readEnvironment(name)?.trim();
  if (!value || !/^price_[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Missing or invalid ${name}`);
  }
  return value;
}

export function resolveStripeSku(
  value: unknown,
  readEnvironment: EnvironmentReader,
): StripeSkuConfig {
  if (!isStripeSku(value)) {
    throw new Error('Unknown subscription SKU');
  }

  const definition = SKU_DEFINITIONS[value];
  return {
    sku: value,
    plan: definition.plan,
    billingPeriod: definition.billingPeriod,
    priceId: configuredPriceId(definition.priceEnvironmentVariable, readEnvironment),
  };
}

export function loadStripeCatalog(
  readEnvironment: EnvironmentReader,
): Record<StripeSku, StripeSkuConfig> {
  return Object.fromEntries(
    STRIPE_SKUS.map((sku) => [sku, resolveStripeSku(sku, readEnvironment)]),
  ) as Record<StripeSku, StripeSkuConfig>;
}

function approvedBaseUrl(value: string): URL {
  const url = new URL(value);
  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if ((url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:'))
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash) {
    throw new Error('APP_BASE_URL must be an HTTPS origin');
  }
  return url;
}

function destinationPath<T extends Record<string, string>>(
  value: unknown,
  destinations: T,
  fieldName: string,
): T[keyof T] {
  if (typeof value !== 'string' || !(value in destinations)) {
    throw new Error(`Unknown ${fieldName}`);
  }
  return destinations[value as keyof T];
}

function appUrl(baseUrl: string, path: string): string {
  return new URL(path, approvedBaseUrl(baseUrl)).toString();
}

export function resolveCheckoutUrls(
  value: unknown,
  baseUrl: string,
): { successUrl: string; cancelUrl: string } {
  if (!value || typeof value !== 'object') {
    throw new Error('callbackDestinations is required');
  }
  const input = value as Record<string, unknown>;
  const successPath = destinationPath(
    input.success,
    CHECKOUT_SUCCESS_DESTINATIONS,
    'checkout success destination',
  );
  const cancelPath = destinationPath(
    input.cancel,
    CHECKOUT_CANCEL_DESTINATIONS,
    'checkout cancel destination',
  );
  const separator = successPath.includes('?') ? '&' : '?';

  return {
    successUrl: `${appUrl(baseUrl, successPath)}${separator}subscription=1&checkout_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: appUrl(baseUrl, cancelPath),
  };
}

export function resolvePortalReturnUrl(value: unknown, baseUrl: string): string {
  const path = destinationPath(
    value,
    PORTAL_RETURN_DESTINATIONS,
    'billing portal return destination',
  );
  return appUrl(baseUrl, path);
}

export function validateCheckoutIdempotencyKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) {
    throw new Error('idempotencyKey must be 16-128 URL-safe characters');
  }
  return value;
}

export function stripeCheckoutIdempotencyKey(userId: string, requestKey: string): string {
  return `nalichat_checkout_${userId}_${requestKey}`.slice(0, 255);
}

export function stripeEnvironment(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{1,31}$/.test(value)) {
    throw new Error('Missing or invalid Stripe environment');
  }
  return value;
}

export function stripeEnvironmentFromSecretKey(value: unknown): 'test' | 'live' {
  if (typeof value !== 'string') {
    throw new Error('Missing or invalid STRIPE_SECRET_KEY');
  }
  if (/^(?:sk|rk)_test_/.test(value)) return 'test';
  if (/^(?:sk|rk)_live_/.test(value)) return 'live';
  throw new Error('Unable to determine Stripe environment from STRIPE_SECRET_KEY');
}

export function trialEligibility(
  userTrialUsedAt: unknown,
  subscriptions: readonly TrialBearingRecord[],
): { eligible: boolean; reason: 'eligible' | 'account_used' | 'prior_record' } {
  if (typeof userTrialUsedAt === 'string' && userTrialUsedAt.length > 0) {
    return { eligible: false, reason: 'account_used' };
  }

  const hasPriorTrial = subscriptions.some((subscription) => (
    subscription.status === 'trialing'
    || (typeof subscription.trial_used_at === 'string' && subscription.trial_used_at.length > 0)
    || (typeof subscription.trial_started_at === 'string' && subscription.trial_started_at.length > 0)
    || (typeof subscription.trial_end_date === 'string' && subscription.trial_end_date.length > 0)
  ));
  return hasPriorTrial
    ? { eligible: false, reason: 'prior_record' }
    : { eligible: true, reason: 'eligible' };
}

export function normalizeStripeMetadata(
  metadata: unknown,
): {
  userId: string;
  plan: Exclude<SubscriptionPlan, 'free'>;
  billingPeriod: BillingPeriod;
  sku: StripeSku;
  environment: string;
} | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }
  const values = metadata as Record<string, unknown>;
  if (!isStripeSku(values.nali_sku)) {
    return null;
  }
  const definition = SKU_DEFINITIONS[values.nali_sku];
  if (
    typeof values.nali_user_id !== 'string'
    || values.nali_user_id.length < 1
    || values.nali_user_id.length > 128
    || values.nali_plan !== definition.plan
    || values.nali_period !== definition.billingPeriod
  ) {
    return null;
  }

  let environment: string;
  try {
    environment = stripeEnvironment(values.nali_environment);
  } catch {
    return null;
  }

  return {
    userId: values.nali_user_id,
    plan: definition.plan,
    billingPeriod: definition.billingPeriod,
    sku: values.nali_sku,
    environment,
  };
}

export function unixSecondsToIso(value: number | null | undefined): string | undefined {
  if (!Number.isFinite(value) || (value as number) <= 0) {
    return undefined;
  }
  return new Date((value as number) * 1000).toISOString();
}

export function mapStripeSubscriptionStatus(
  status: unknown,
  currentPeriodEnd?: number | null,
  nowMs = Date.now(),
): SubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'unpaid';
    case 'incomplete':
      return 'incomplete';
    case 'incomplete_expired':
      return 'ended';
    case 'paused':
      return 'unpaid';
    case 'canceled': {
      const periodEndMs = typeof currentPeriodEnd === 'number'
        ? currentPeriodEnd * 1000
        : Number.NaN;
      return Number.isFinite(periodEndMs) && periodEndMs > nowMs ? 'canceled' : 'ended';
    }
    default:
      throw new Error(`Unsupported Stripe subscription status: ${String(status)}`);
  }
}

export function subscriptionUpdateFromStripe(
  subscription: StripeSubscriptionSnapshot,
  nowMs = Date.now(),
): StripeSubscriptionUpdate {
  const update: StripeSubscriptionUpdate = {
    status: mapStripeSubscriptionStatus(
      subscription.status,
      subscription.current_period_end,
      nowMs,
    ),
    stripe_subscription_status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end === true,
  };
  const periodEnd = unixSecondsToIso(subscription.current_period_end);
  const trialStart = unixSecondsToIso(subscription.trial_start);
  const trialEnd = unixSecondsToIso(subscription.trial_end);
  if (periodEnd) update.current_period_end = periodEnd;
  if (trialStart) update.trial_started_at = trialStart;
  if (trialEnd) update.trial_end_date = trialEnd;
  return update;
}

export function shouldApplyStripeEvent(
  lastCreated: unknown,
  lastEventId: unknown,
  eventCreated: number,
  eventId: string,
): boolean {
  if (lastEventId === eventId) {
    return false;
  }
  if (typeof lastCreated !== 'number' || !Number.isFinite(lastCreated)) {
    return true;
  }
  return eventCreated >= lastCreated;
}

export function webhookLedgerAction(
  state: unknown,
  updatedAt: unknown,
  nowMs = Date.now(),
): 'duplicate' | 'busy' | 'retry' | 'start' {
  if (state === 'processed' || state === 'ignored') {
    return 'duplicate';
  }
  if (state !== 'processing') {
    return state === undefined || state === null ? 'start' : 'retry';
  }

  const updatedAtMs = typeof updatedAt === 'string' ? Date.parse(updatedAt) : Number.NaN;
  return Number.isFinite(updatedAtMs) && nowMs - updatedAtMs >= 10 * 60 * 1000
    ? 'retry'
    : 'busy';
}
