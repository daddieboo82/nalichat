import { describe, expect, it } from 'vitest';
import {
  loadStripeCatalog,
  mapStripeSubscriptionStatus,
  normalizeStripeMetadata,
  resolveCheckoutUrls,
  resolvePortalReturnUrl,
  resolveStripeSku,
  shouldApplyStripeEvent,
  stripeEnvironmentFromSecretKey,
  subscriptionUpdateFromStripe,
  trialEligibility,
  validateCheckoutIdempotencyKey,
  webhookLedgerAction,
} from '../../../base44/shared/stripeBilling.ts';

const ENVIRONMENT = {
  STRIPE_PRICE_PREMIUM_MONTHLY: 'price_premium_monthly',
  STRIPE_PRICE_PREMIUM_YEARLY: 'price_premium_yearly',
  STRIPE_PRICE_PREMIUM_PLUS_MONTHLY: 'price_plus_monthly',
  STRIPE_PRICE_PREMIUM_PLUS_YEARLY: 'price_plus_yearly',
};
const readEnvironment = (name) => ENVIRONMENT[name];

describe('Stripe subscription SKU catalog', () => {
  it.each([
    ['premium_monthly', 'premium', 'monthly', 'price_premium_monthly'],
    ['premium_yearly', 'premium', 'annual', 'price_premium_yearly'],
    ['premium_plus_monthly', 'premium_plus', 'monthly', 'price_plus_monthly'],
    ['premium_plus_yearly', 'premium_plus', 'annual', 'price_plus_yearly'],
  ])('resolves %s exclusively from server configuration', (sku, plan, period, priceId) => {
    expect(resolveStripeSku(sku, readEnvironment)).toEqual({
      sku,
      plan,
      billingPeriod: period,
      priceId,
    });
  });

  it.each(['free', 'pro', 'price_attacker_selected', '', null])(
    'rejects unapproved SKU %s',
    (sku) => {
      expect(() => resolveStripeSku(sku, readEnvironment)).toThrow('Unknown subscription SKU');
    },
  );

  it('requires all four configured Stripe prices', () => {
    expect(() => loadStripeCatalog((name) => (
      name === 'STRIPE_PRICE_PREMIUM_PLUS_YEARLY' ? undefined : readEnvironment(name)
    ))).toThrow('STRIPE_PRICE_PREMIUM_PLUS_YEARLY');
  });
});

describe('Stripe callback destinations', () => {
  it('builds checkout URLs from approved identifiers', () => {
    expect(resolveCheckoutUrls(
      { success: 'subscription_thank_you', cancel: 'pricing' },
      'https://chat.example.com',
    )).toEqual({
      successUrl: 'https://chat.example.com/ThankYou?subscription=1&checkout_id={CHECKOUT_SESSION_ID}',
      cancelUrl: 'https://chat.example.com/pricing',
    });
    expect(resolvePortalReturnUrl('settings', 'https://chat.example.com'))
      .toBe('https://chat.example.com/settings');
  });

  it.each([
    { success: 'https://evil.example/steal', cancel: 'pricing' },
    { success: 'subscription_thank_you', cancel: '//evil.example/steal' },
    { success: 'subscription_thank_you', cancel: 'javascript:alert(1)' },
  ])('rejects unapproved callback values', (destinations) => {
    expect(() => resolveCheckoutUrls(destinations, 'https://chat.example.com')).toThrow('Unknown');
  });

  it('rejects an unsafe configured application origin', () => {
    expect(() => resolvePortalReturnUrl('pricing', 'https://good.example@evil.example?x=1'))
      .toThrow('APP_BASE_URL');
    expect(() => resolvePortalReturnUrl('pricing', 'https://chat.example.com/app/'))
      .toThrow('APP_BASE_URL');
  });
});

describe('checkout and trial replay controls', () => {
  it('accepts stable URL-safe retry keys and rejects weak values', () => {
    expect(validateCheckoutIdempotencyKey('checkout_retry_1234')).toBe('checkout_retry_1234');
    expect(() => validateCheckoutIdempotencyKey('short')).toThrow('idempotencyKey');
    expect(() => validateCheckoutIdempotencyKey('https://evil.test/')).toThrow('idempotencyKey');
  });

  it('allows a trial only when the account and history are clean', () => {
    expect(trialEligibility(null, [{ status: 'pending' }])).toEqual({
      eligible: true,
      reason: 'eligible',
    });
    expect(trialEligibility('2026-09-01T00:00:00.000Z', [])).toEqual({
      eligible: false,
      reason: 'account_used',
    });
    expect(trialEligibility(null, [{ status: 'ended', trial_started_at: '2026-01-01' }]))
      .toEqual({ eligible: false, reason: 'prior_record' });
    expect(trialEligibility(null, [{ status: 'trialing' }]))
      .toEqual({ eligible: false, reason: 'prior_record' });
  });
});

describe('Stripe environment detection', () => {
  it('derives the environment from the configured Stripe secret key', () => {
    expect(stripeEnvironmentFromSecretKey('sk_test_123')).toBe('test');
    expect(stripeEnvironmentFromSecretKey('rk_test_123')).toBe('test');
    expect(stripeEnvironmentFromSecretKey('sk_live_123')).toBe('live');
    expect(stripeEnvironmentFromSecretKey('rk_live_123')).toBe('live');
    expect(() => stripeEnvironmentFromSecretKey('invalid')).toThrow('Stripe environment');
  });
});

describe('Stripe subscription reconciliation', () => {
  it.each([
    ['trialing', 'trialing'],
    ['active', 'active'],
    ['past_due', 'unpaid'],
    ['unpaid', 'unpaid'],
    ['incomplete', 'incomplete'],
    ['incomplete_expired', 'ended'],
    ['paused', 'unpaid'],
  ])('maps Stripe %s to canonical %s', (stripeStatus, canonicalStatus) => {
    expect(mapStripeSubscriptionStatus(stripeStatus)).toBe(canonicalStatus);
  });

  it('retains canceled access through the paid period', () => {
    const now = Date.parse('2026-09-10T00:00:00.000Z');
    expect(mapStripeSubscriptionStatus('canceled', 1789084800, now)).toBe('canceled');
    expect(mapStripeSubscriptionStatus('canceled', 1788912000, now)).toBe('ended');
    expect(subscriptionUpdateFromStripe({
      id: 'sub_123',
      status: 'active',
      cancel_at_period_end: true,
      current_period_end: 1789084800,
    }, now)).toMatchObject({
      status: 'active',
      cancel_at_period_end: true,
      current_period_end: '2026-09-11T00:00:00.000Z',
    });
  });

  it('ignores duplicate and out-of-order events', () => {
    expect(shouldApplyStripeEvent(100, 'evt_same', 100, 'evt_same')).toBe(false);
    expect(shouldApplyStripeEvent(100, 'evt_new', 99, 'evt_old')).toBe(false);
    expect(shouldApplyStripeEvent(100, 'evt_old', 101, 'evt_new')).toBe(true);
  });

  it('handles event-ledger replays and processing leases', () => {
    const now = Date.parse('2026-09-10T12:00:00.000Z');
    expect(webhookLedgerAction('processed', '2026-09-10T11:59:00.000Z', now))
      .toBe('duplicate');
    expect(webhookLedgerAction('processing', '2026-09-10T11:59:00.000Z', now))
      .toBe('busy');
    expect(webhookLedgerAction('processing', '2026-09-10T11:49:59.000Z', now))
      .toBe('retry');
    expect(webhookLedgerAction('failed', '2026-09-10T11:59:00.000Z', now))
      .toBe('retry');
    expect(webhookLedgerAction(undefined, undefined, now)).toBe('start');
  });

  it('normalizes only internally consistent metadata', () => {
    const valid = {
      nali_user_id: 'user_123',
      nali_plan: 'premium_plus',
      nali_period: 'annual',
      nali_sku: 'premium_plus_yearly',
      nali_environment: 'test',
    };
    expect(normalizeStripeMetadata(valid)).toEqual({
      userId: 'user_123',
      plan: 'premium_plus',
      billingPeriod: 'annual',
      sku: 'premium_plus_yearly',
      environment: 'test',
    });
    expect(normalizeStripeMetadata({ ...valid, nali_plan: 'premium' })).toBeNull();
    expect(normalizeStripeMetadata({ ...valid, nali_sku: 'free' })).toBeNull();
    expect(normalizeStripeMetadata({ ...valid, nali_environment: '../prod' })).toBeNull();
  });
});
