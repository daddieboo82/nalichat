import { describe, expect, it } from 'vitest';
import {
  ENTITLEMENT_KEYS,
  resolveEntitlements,
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
