import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  paypalPeriodEndForStatus,
  resolvePayPalSubscriptionStatus,
} from '../../../base44/shared/paypalSubscription.ts';

const NOW = Date.parse('2026-10-30T12:00:00.000Z');

describe('PayPal subscription access', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not expire an active plan when PayPal has not published a future billing time', () => {
    expect(paypalPeriodEndForStatus('active', '2026-10-30T11:00:00.000Z', NOW)).toBeNull();
    expect(paypalPeriodEndForStatus('active', 'not-a-date', NOW)).toBeUndefined();
    expect(paypalPeriodEndForStatus('active', '2026-11-30T12:00:00.000Z', NOW)).toBe('2026-11-30T12:00:00.000Z');
  });

  it('keeps a canceled period boundary so access can end on time', () => {
    expect(paypalPeriodEndForStatus('canceled', '2026-11-30T12:00:00.000Z', NOW)).toBe('2026-11-30T12:00:00.000Z');
    expect(paypalPeriodEndForStatus('canceled', '2026-10-01T12:00:00.000Z', NOW)).toBe('2026-10-01T12:00:00.000Z');
  });

  it('activates an approved subscription and keeps that status if the follow-up read lags', async () => {
    const remote = { status: 'APPROVED', billing_info: { next_billing_time: '2020-01-01T00:00:00.000Z' } };
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/activate')) return new Response(null, { status: 204 });
      return Response.json({ status: 'APPROVED' });
    }));

    const status = await resolvePayPalSubscriptionStatus('https://api-m.paypal.com', 'token', 'I-APPROVED', remote);
    expect(status).toBe('ACTIVE');
  });

  it('grants access when activation loses a race but PayPal is already active', async () => {
    const remote = { status: 'APPROVED' };
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/activate')) return new Response('{}', { status: 422 });
      return Response.json({
        status: 'ACTIVE',
        billing_info: { next_billing_time: '2026-11-30T12:00:00.000Z' },
      });
    }));

    const status = await resolvePayPalSubscriptionStatus('https://api-m.sandbox.paypal.com', 'token', 'I-RACE', remote);
    expect(status).toBe('ACTIVE');
    expect(remote.billing_info.next_billing_time).toBe('2026-11-30T12:00:00.000Z');
    expect(paypalPeriodEndForStatus('active', remote.billing_info.next_billing_time, NOW)).toBe('2026-11-30T12:00:00.000Z');
  });
});
