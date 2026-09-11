// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('webhook reconciliation lookup bounds', () => {
  it('preserves duplicate detection while capping Stripe exact-ID lookups', async () => {
    const stripe = await readText('base44/functions/stripeWebhook/entry.ts');
    expect(stripe).toContain("Subscription.filter({ checkout_id: checkoutId }, '-created_date', 2)");
    expect(stripe).toContain("Subscription.filter({ subscription_id: subscriptionId }, '-created_date', 2)");
    expect(stripe).toContain("User.filter({ id: userId }, '-created_date', 2)");
    expect(stripe).toContain("Base44Purchase.filter({ checkoutSessionId: session.id }, '-created_date', 2)");
    expect(stripe).toContain("StripeWebhookEvent.filter({ stripe_event_id: event.id }, '-created_date', 2)");
  });

  it('caps legacy Wix subscription-ID lookups', async () => {
    const wix = await readText('base44/functions/wixPaymentsWebhook/entry.ts');
    expect(wix.match(/Subscription\.filter\([\s\S]*subscription_id: subscriptionId[\s\S]*'-created_date',[\s\S]*1/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
