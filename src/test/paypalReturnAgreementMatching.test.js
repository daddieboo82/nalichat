import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal checkout return agreement matching', () => {
  it('stores the server-created agreement ID before leaving for PayPal', async () => {
    const src = await readFile('src/lib/subscriptionBilling.js', 'utf8');
    expect(src).toContain('sessionStorage.setItem(CHECKOUT_SUBSCRIPTION_ID_KEY, payload.subscriptionId)');
    expect(src.indexOf('sessionStorage.setItem(CHECKOUT_SUBSCRIPTION_ID_KEY, payload.subscriptionId)'))
      .toBeLessThan(src.indexOf('redirect(checkoutUrl.toString())'));
  });

  it('requires a matching agreement for conversion tracking and checkout return confirmation', async () => {
    const backend = await readFile('base44/functions/checkSubscriptionStatus/entry.ts', 'utf8');
    expect(backend).toContain("verifiedPayPalAgreementId: hasPaidAccess && selected?.provider === 'paypal'");
    const ui = await readFile('src/pages/ThankYou.jsx', 'utf8');
    expect(ui).toContain('subscription?.verifiedPayPalAgreementId !== expectedPayPalAgreementId');
    expect(ui).toContain('expectedPayPalAgreementId === result.subscription.verifiedPayPalAgreementId');
    expect(ui).toContain('sessionStorage.removeItem(CHECKOUT_SUBSCRIPTION_ID_KEY)');
  });
});
