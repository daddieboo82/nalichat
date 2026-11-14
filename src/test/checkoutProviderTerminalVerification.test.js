import { describe, expect, it, vi } from 'vitest';
import {
  verifyPayPalTerminalCheckout,
  verifyWixTerminalCheckout,
} from '@/lib/checkoutProviderTerminalVerification';

const intent = {
  intentId: 'intent-abc', accountId: 'account-123', provider: 'paypal',
  providerRequestId: 'request-provider-123', providerId: 'I-EXAMPLE1234567',
};

describe('draft provider terminal verification policy, isolated mocked provider', () => {
  it('accepts matching PayPal subscription only in EXPIRED state', async () => {
    const read = vi.fn().mockResolvedValue({ id: intent.providerId, status: 'EXPIRED' });
    const proof = await verifyPayPalTerminalCheckout(intent, read);
    expect(read).toHaveBeenCalledExactlyOnceWith(intent.providerId);
    expect(proof).toEqual({
      verified: true, terminal: true, intentId: intent.intentId,
      accountId: intent.accountId, provider: 'paypal',
      providerRequestId: intent.providerRequestId,
    });
  });

  it.each(['APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'CANCELLED',
    'UNKNOWN', '', null, undefined])('rejects nonterminal PayPal status %s', async (status) => {
    await expect(verifyPayPalTerminalCheckout(intent,
      async () => ({ id: intent.providerId, status }))).rejects.toThrow();
  });

  it('rejects mismatched or missing provider identifiers and failed reads', async () => {
    await expect(verifyPayPalTerminalCheckout(intent, async () => ({
      id: 'I-DIFFERENT12345', status: 'EXPIRED',
    }))).rejects.toThrow();
    await expect(verifyPayPalTerminalCheckout({ ...intent, providerId: '' },
      async () => ({ id: '', status: 'EXPIRED' }))).rejects.toThrow();
    await expect(verifyPayPalTerminalCheckout({ ...intent, provider: 'wix' },
      async () => ({ id: intent.providerId, status: 'EXPIRED' }))).rejects.toThrow();
    await expect(verifyPayPalTerminalCheckout(intent, async () => {
      throw new Error('PayPal lookup unavailable');
    })).rejects.toThrow();
    await expect(verifyPayPalTerminalCheckout(intent, null)).rejects.toThrow();
  });

  it('fails closed for Wix until independent provider verification is available', async () => {
    await expect(verifyWixTerminalCheckout({ ...intent, provider: 'wix' })).rejects.toThrow();
  });
});
