import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('On-demand PayPal status resilience', () => {
  it('isolates failed agreement checks and verifies provider ownership before updates', async () => {
    const src = await readFile('base44/functions/checkSubscriptionStatus/entry.ts', 'utf8');
    expect(src).toContain('for (const subscription of pending) {\n      try {');
    expect(src).toContain('Individual pending PayPal reconciliation failed');
    expect(src).toContain('subscription.paypal_environment !== expectedEnvironment');
    expect(src).toContain('remote?.plan_id !== subscription.paypal_plan_id');
    expect(src).toContain("remote?.custom_id !== subscription.user_id + ':' + subscription.sku");
    expect(src.indexOf('remote?.custom_id !== subscription.user_id'))
      .toBeLessThan(src.indexOf('await resolvePayPalSubscriptionStatus('));
    expect(src.indexOf('await resolvePayPalSubscriptionStatus('))
      .toBeLessThan(src.indexOf('await subscriptionEntity.update('));
  });

  it('gives existing PayPal subscribers a Settings instruction instead of a Stripe portal instruction', async () => {
    const src = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    expect(src).toContain('Manage your existing subscription in Settings');
    expect(src).not.toContain('use the billing portal');
  });
});
