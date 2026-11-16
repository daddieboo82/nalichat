import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal confirmed-purchase analytics identity', () => {
  it('only exposes a verified paid subscription record to analytics', async () => {
    const backend = await readFile('base44/functions/checkSubscriptionStatus/entry.ts', 'utf8');
    expect(backend).toContain("subscriptionRecordId: hasPaidAccess && typeof selected?.id === 'string' ? selected.id : null");
    const client = await readFile('src/lib/subscriptionClient.js', 'utf8');
    expect(client).toContain('subscriptionRecordId: typeof source.subscriptionRecordId === "string"');
  });

  it('does not reuse a generic conversion key across different subscriptions', async () => {
    const source = await readFile('src/pages/ThankYou.jsx', 'utf8');
    expect(source).toContain('const verifiedSubscriptionRecordId = result.subscription.subscriptionRecordId;');
    expect(source).toContain('nalichat_subscription_confirmation:${verifiedTransactionKey}');
    expect(source).toContain('if (analyticsKey) localStorage.setItem(analyticsKey, "1");');
    expect(source).not.toContain('nalichat_subscription_confirmation:${checkoutId || subscriptionId || "unknown"}');
  });
});
