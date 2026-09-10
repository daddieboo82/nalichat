import { describe, expect, it } from 'vitest';
import {
  ENTITLEMENT_KEYS,
  normalizePlan,
  resolveEntitlements,
  resolveSubscriptionLimits,
} from '../../../base44/shared/subscription.ts';

const PAID_STATUSES = ['active', 'trialing'];
const NO_PAID_ACCESS_STATUSES = ['ended', 'pending', 'unpaid', 'incomplete'];

describe('subscription entitlement matrix', () => {
  it.each(['active', 'trialing', 'canceled', 'ended', 'pending', 'unpaid', 'incomplete'])(
    'always grants core chat to free/%s',
    (status) => {
      const entitlements = resolveEntitlements('free', status);
      expect(entitlements['chat.core']).toBe(true);
      expect(Object.values(entitlements).filter(Boolean)).toHaveLength(1);
      expect(Object.keys(entitlements)).toEqual([...ENTITLEMENT_KEYS]);
    },
  );

  it.each(PAID_STATUSES)('grants Premium entitlements while %s', (status) => {
    const entitlements = resolveEntitlements('premium', status);
    expect(entitlements).toMatchObject({
      'chat.core': true,
      'ai.standard': true,
      'messages.schedule': true,
      'search.advanced': true,
      'files.large_upload': true,
      'chat.export': true,
      'appearance.premium_themes': true,
      'voice.transcription': true,
      'ai.high_limits': false,
      'ai.best_model': false,
      'calls.summary': false,
      'reminders.follow_up': false,
      'privacy.locked_chats': false,
    });

    describe('subscription usage limits', () => {
      it.each([
        ['free', 20, 2],
        ['premium', 200, 10],
        ['premium_plus', 1_000, 20],
      ])('resolves %s numeric limits', (plan, aiRequests, uploadGiB) => {
        const limits = resolveSubscriptionLimits(plan, 'active');
        expect(limits.ai.requestsPerUtcDay).toBe(aiRequests);
        expect(limits.upload.maxBytes).toBe(uploadGiB * 1024 * 1024 * 1024);
      });

      it('falls back to free limits after paid access expires', () => {
        const limits = resolveSubscriptionLimits('premium_plus', 'canceled', {
          currentPeriodEnd: '2026-09-10T00:00:00.000Z',
          now: '2026-09-10T00:00:00.000Z',
        });
        expect(limits.ai.requestsPerUtcDay).toBe(20);
        expect(limits.upload.maxBytes).toBe(2 * 1024 * 1024 * 1024);
      });

      it.each(['pro', 'pro_filesharing'])('maps grandfathered %s accounts to Plus limits', (plan) => {
        const limits = resolveSubscriptionLimits(normalizePlan(plan), 'active');
        expect(limits.ai.requestsPerUtcDay).toBe(1_000);
        expect(limits.upload.maxBytes).toBe(20 * 1024 * 1024 * 1024);
      });
    });
  });

  it.each(PAID_STATUSES)('grants every Premium Plus entitlement while %s', (status) => {
    expect(Object.values(resolveEntitlements('premium_plus', status)).every(Boolean)).toBe(true);
  });

  it('ends trialing access at the recorded trial end', () => {
    const entitlements = resolveEntitlements('premium', 'trialing', {
      trialEndDate: '2026-09-10T00:00:00.000Z',
      now: '2026-09-10T00:00:00.000Z',
    });

    expect(entitlements['chat.core']).toBe(true);
    expect(entitlements['ai.standard']).toBe(false);
  });

  it.each(NO_PAID_ACCESS_STATUSES)(
    'removes paid-tier entitlements from Premium and Premium Plus while %s',
    (status) => {
      for (const plan of ['premium', 'premium_plus']) {
        const entitlements = resolveEntitlements(plan, status);
        expect(entitlements['chat.core']).toBe(true);
        expect(Object.values(entitlements).filter(Boolean)).toHaveLength(1);
      }
    },
  );

  it.each(['premium', 'premium_plus'])(
    'removes paid-tier entitlements from %s when canceled without a future period end',
    (plan) => {
      const missingEnd = resolveEntitlements(plan, 'canceled');
      const expired = resolveEntitlements(plan, 'canceled', {
        currentPeriodEnd: '2026-09-09T00:00:00.000Z',
        now: '2026-09-10T00:00:00.000Z',
      });

      expect(Object.values(missingEnd).filter(Boolean)).toHaveLength(1);
      expect(Object.values(expired).filter(Boolean)).toHaveLength(1);
      expect(missingEnd['chat.core']).toBe(true);
      expect(expired['chat.core']).toBe(true);
    },
  );

  it('retains paid access for a canceled subscription until its period end', () => {
    const beforeEnd = resolveEntitlements('premium_plus', 'canceled', {
      currentPeriodEnd: '2026-09-11T00:00:00.000Z',
      now: '2026-09-10T00:00:00.000Z',
    });
    const atEnd = resolveEntitlements('premium_plus', 'canceled', {
      currentPeriodEnd: '2026-09-11T00:00:00.000Z',
      now: '2026-09-11T00:00:00.000Z',
    });

    expect(beforeEnd['ai.best_model']).toBe(true);
    expect(atEnd['ai.best_model']).toBe(false);
    expect(atEnd['chat.core']).toBe(true);
  });
});
