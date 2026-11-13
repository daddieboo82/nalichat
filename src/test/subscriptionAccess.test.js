// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  hasPaidTierAccess,
  requiresExistingPayPalCheckoutReview,
  resolveEntitlements,
} from '../../base44/shared/subscription.ts';

describe('server subscription entitlement expiry', () => {
  const now = '2026-09-11T06:00:00.000Z';

  it('denies an active subscription whose explicit period already ended', () => {
    expect(hasPaidTierAccess('active', {
      currentPeriodEnd: '2026-09-10T06:00:00.000Z',
      now,
    })).toBe(false);

    const entitlements = resolveEntitlements('premium_plus', 'active', {
      currentPeriodEnd: '2026-09-10T06:00:00.000Z',
      now,
    });
    expect(entitlements['chat.core']).toBe(true);
    expect(entitlements['files.large_upload']).toBe(false);
    expect(entitlements['ai.best_model']).toBe(false);
  });

  it('keeps active legacy/manual subscriptions without a period end working', () => {
    expect(hasPaidTierAccess('active', { now })).toBe(true);
  });

  it('reviews unresolved active PayPal billing before cross-provider checkout', () => {
    expect(requiresExistingPayPalCheckoutReview('paypal', 'premium', 'active', null, now)).toBe(true);
    expect(requiresExistingPayPalCheckoutReview('paypal', 'premium', 'active', 'invalid', now)).toBe(true);
    expect(requiresExistingPayPalCheckoutReview('paypal', 'premium', 'active', '2026-09-10T06:00:00Z', now)).toBe(true);
    expect(requiresExistingPayPalCheckoutReview('paypal', 'premium', 'active', '2026-10-10T06:00:00Z', now)).toBe(false);
    expect(requiresExistingPayPalCheckoutReview('paypal', 'premium', 'pending', null, now)).toBe(false);
    expect(requiresExistingPayPalCheckoutReview('paypal', 'free', 'active', null, now)).toBe(false);
    expect(requiresExistingPayPalCheckoutReview('manual', 'premium_plus', 'active', null, now)).toBe(false);
    expect(requiresExistingPayPalCheckoutReview('stripe', 'premium', 'active', null, now)).toBe(false);
  });

  it('denies expired trials and canceled periods', () => {
    expect(hasPaidTierAccess('trialing', {
      trialEndDate: '2026-09-10T06:00:00.000Z',
      now,
    })).toBe(false);
    expect(hasPaidTierAccess('canceled', {
      currentPeriodEnd: '2026-09-10T06:00:00.000Z',
      now,
    })).toBe(false);
  });
});
