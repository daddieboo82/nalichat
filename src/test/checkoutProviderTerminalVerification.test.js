import { describe, expect, it, vi } from 'vitest';
import {
  verifyPayPalTerminalCheckout,
  verifyWixTerminalCheckout,
} from '@/lib/checkoutProviderTerminalVerification';

const intent = {
  intentId: 'intent-abc', accountId: 'account-123', provider: 'paypal',
  providerRequestId: 'request-provider-123', providerId: 'I-EXAMPLE1234567',
  sku: 'premium_monthly',
};

describe('draft provider terminal verification policy, isolated mocked provider', () => {
  it('accepts matching PayPal subscription only in EXPIRED state', async () => {
    const read = vi.fn().mockResolvedValue({ id: intent.providerId, status: 'EXPIRED',
      custom_id: intent.accountId + ':' + intent.sku, plan_id: 'P-MOCKPLAN123' });
    const proof = await verifyPayPalTerminalCheckout(intent, read, 'P-MOCKPLAN123');
    expect(read).toHaveBeenCalledExactlyOnceWith(intent.providerId);
    expect(proof).toEqual({
      verified: true, terminal: true, intentId: intent.intentId,
      accountId: intent.accountId, provider: 'paypal',
      providerRequestId: intent.providerRequestId,
    });
  });

  it.each(['APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'CANCELLED',
    'UNKNOWN', '', null, undefined])('rejects nonterminal PayPal status %s', async (status) => {
    await expect(verifyPayPalTerminalCheckout(intent, async () => ({ id: intent.providerId, status,
        custom_id: intent.accountId + ':' + intent.sku, plan_id: 'P-MOCKPLAN123' }), 'P-MOCKPLAN123')).rejects.toThrow();
  });

  it('rejects valid expired subscriptions with mismatched customer, SKU or missing binding', async () => {
    const good = {
      id: intent.providerId, status: 'EXPIRED',
      custom_id: intent.accountId + ':' + intent.sku, plan_id: 'P-MOCKPLAN123',
    };
    for (const remote of [
      { ...good, custom_id: 'other-account:' + intent.sku },
      { ...good, custom_id: intent.accountId + ':premium_plus_monthly' },
      { ...good, custom_id: undefined },
      { ...good, plan_id: undefined },
      { ...good, plan_id: 'P-DIFFERENT123' },
    ]) {
      await expect(verifyPayPalTerminalCheckout(intent, async () => remote, 'P-MOCKPLAN123')).rejects.toThrow();
    }
  });

  it('rejects mismatched or missing provider identifiers and failed reads', async () => {
    await expect(verifyPayPalTerminalCheckout(intent, async () => ({
      id: 'I-DIFFERENT12345', status: 'EXPIRED',
    }), 'P-MOCKPLAN123')).rejects.toThrow();
    await expect(verifyPayPalTerminalCheckout({ ...intent, providerId: '' },
      async () => ({ id: '', status: 'EXPIRED' }), 'P-MOCKPLAN123')).rejects.toThrow();
    await expect(verifyPayPalTerminalCheckout({ ...intent, provider: 'wix' },
      async () => ({ id: intent.providerId, status: 'EXPIRED',
      custom_id: intent.accountId + ':' + intent.sku, plan_id: 'P-MOCKPLAN123' }), 'P-MOCKPLAN123')).rejects.toThrow();
    await expect(verifyPayPalTerminalCheckout(intent, async () => {
      throw new Error('PayPal lookup unavailable');
    }, 'P-MOCKPLAN123')).rejects.toThrow();
    await expect(verifyPayPalTerminalCheckout(intent, null, 'P-MOCKPLAN123')).rejects.toThrow();
  });

  it('rejects missing or untrusted expected plan ID even for expired subscription', async () => {
    const remote = {
      id: intent.providerId, status: 'EXPIRED',
      custom_id: intent.accountId + ':' + intent.sku, plan_id: 'P-MOCKPLAN123',
    };
    await expect(verifyPayPalTerminalCheckout(intent, async () => remote)).rejects.toThrow();
    await expect(verifyPayPalTerminalCheckout(intent, async () => remote, 'bad')).rejects.toThrow();
  });

  it('fails closed for Wix until independent provider verification is available', async () => {
    await expect(verifyWixTerminalCheckout({ ...intent, provider: 'wix' })).rejects.toThrow();
  });
});
