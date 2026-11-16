import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Active PayPal subscription verification', () => {
  it('verifies active agreements against PayPal on user status refresh', async () => {
    const source = await readFile('base44/functions/checkSubscriptionStatus/entry.ts', 'utf8');
    expect(source).toContain('await reconcileActivePayPal(subscriptionEntity, subs)');
    expect(source).toContain("subscription.provider === 'paypal' && subscription.status === 'active'");
    expect(source).toContain("remote?.id !== subscription.subscription_id");
    expect(source).toContain("remote?.plan_id !== subscription.paypal_plan_id");
    expect(source).toContain("remote?.custom_id !== subscription.user_id + ':' + subscription.sku");
    expect(source).toContain("const verifiedStatus = paypalStatus(remote?.status)");
    expect(source).toContain("if (!verifiedStatus) continue;");
    expect(source).toContain("if (Object.keys(update).length)");
    const activeSection = source.split('async function reconcileActivePayPal(')[1].split('function subscriptionPriority(')[0];
    expect(activeSection).not.toContain("resolvePayPalSubscriptionStatus(");
    expect(activeSection).not.toContain("'/activate'");
  });
});
