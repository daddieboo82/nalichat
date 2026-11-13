import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  paypalPeriodEndForStatus,
  requiresPayPalBillingVerification,
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

  it('rejects pending-to-active transitions without a verified future billing boundary', () => {
    expect(requiresPayPalBillingVerification('pending', 'active', null, NOW)).toBe(true);
    expect(requiresPayPalBillingVerification('pending', 'active', undefined, NOW)).toBe(true);
    expect(requiresPayPalBillingVerification('pending', 'active', 'bad-date', NOW)).toBe(true);
    expect(requiresPayPalBillingVerification('pending', 'active', '2026-10-29T12:00:00.000Z', NOW)).toBe(true);
    expect(requiresPayPalBillingVerification('pending', 'active', '2026-11-30T12:00:00.000Z', NOW)).toBe(false);
    expect(requiresPayPalBillingVerification('pending', 'canceled', null, NOW)).toBe(false);
    expect(requiresPayPalBillingVerification('active', 'active', undefined, NOW)).toBe(false);
  });

  it('keeps a canceled period boundary so access can end on time', () => {
    expect(paypalPeriodEndForStatus('canceled', '2026-11-30T12:00:00.000Z', NOW)).toBe('2026-11-30T12:00:00.000Z');
    expect(paypalPeriodEndForStatus('canceled', '2026-10-01T12:00:00.000Z', NOW)).toBe('2026-10-01T12:00:00.000Z');
  });

  it('leaves an unapproved subscription pending without calling PayPal activation', async () => {
    const fetchPayPal = vi.fn();
    vi.stubGlobal('fetch', fetchPayPal);

    const status = await resolvePayPalSubscriptionStatus(
      'https://api-m.paypal.com',
      'fixture-token',
      'I-PENDING',
      { status: 'APPROVAL_PENDING' },
    );

    expect(status).toBe('APPROVAL_PENDING');
    expect(fetchPayPal).not.toHaveBeenCalled();
  });

  it('keeps an approved subscription pending if PayPal has not confirmed activation', async () => {
    const remote = { status: 'APPROVED', billing_info: { next_billing_time: '2020-01-01T00:00:00.000Z' } };
    const fetchPayPal = vi.fn(async (url) => {
      if (String(url).endsWith('/activate')) return new Response(null, { status: 204 });
      return Response.json({ status: 'APPROVED' });
    });
    vi.stubGlobal('fetch', fetchPayPal);

    const status = await resolvePayPalSubscriptionStatus('https://api-m.paypal.com', 'token', 'I-APPROVED', remote);
    expect(status).toBe('APPROVED');
    expect(fetchPayPal).toHaveBeenCalledTimes(2);
  });

  it('does not claim ACTIVE when PayPal re-read is unavailable after accepted activation', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/activate')) return new Response(null, { status: 204 });
      throw new Error('provider lookup unavailable');
    }));
    expect(await resolvePayPalSubscriptionStatus(
      'https://api-m.paypal.com', 'token', 'I-UNCONFIRMED', { status: 'APPROVED' },
    )).toBe('APPROVED');
  });

  it('honors a fresh SUSPENDED status even after the activation request succeeded', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/activate')) return new Response(null, { status: 204 });
      return Response.json({ status: 'SUSPENDED' });
    }));
    expect(await resolvePayPalSubscriptionStatus(
      'https://api-m.paypal.com', 'token', 'I-SUSPENDED', { status: 'APPROVED' },
    )).toBe('SUSPENDED');
  });

  it('does not reuse pre-activation billing metadata when the refreshed ACTIVE response omits it', async () => {
    const remote = {
      status: 'APPROVED',
      billing_info: { next_billing_time: '2026-11-30T12:00:00.000Z' },
    };
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).endsWith('/activate')) return new Response(null, { status: 204 });
      return Response.json({ status: 'ACTIVE' });
    }));
    const status = await resolvePayPalSubscriptionStatus(
      'https://api-m.paypal.com', 'token', 'I-NO-NEW-BILLING', remote,
    );
    expect(status).toBe('ACTIVE');
    expect(remote.billing_info).toBeUndefined();
    expect(paypalPeriodEndForStatus('active', remote.billing_info?.next_billing_time, NOW)).toBeUndefined();
    expect(requiresPayPalBillingVerification('pending', 'active', undefined, NOW)).toBe(true);
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
