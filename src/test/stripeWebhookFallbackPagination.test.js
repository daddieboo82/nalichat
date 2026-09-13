import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Stripe webhook fallback pagination', () => {
  it('paginates user Stripe subscriptions before metadata fallback reconciliation', async () => {
    const s = await readFile('base44/functions/stripeWebhook/entry.ts', 'utf8');
    expect(s).toContain('async function loadStripeSubscriptionsForUser(');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain("{ user_id: userId, provider: 'stripe' }");
    expect(s).toContain('const userRecords = await loadStripeSubscriptionsForUser(');
    expect(s).not.toContain("const userRecords = await entities.Subscription.filter({");
  });
});
