// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('exact-match lookup bounds', () => {
  it('limits exact user and checkout-record lookups', async () => {
    const makeAdmin = await readText('base44/functions/makeAdmin/entry.ts');
    const external = await readText('base44/functions/sendExternalMessage/entry.ts');
    const checkout = await readText('base44/functions/createSubscriptionCheckout/entry.ts');

    expect(makeAdmin.match(/User\.filter\(\{ email \}, '-created_date', 1\)/g)?.length).toBe(2);
    expect(external).toContain("User.filter({ email: cleanDestination }, '-created_date', 1)");
    expect(checkout.match(/User\.filter\(\{ id: user\.id \}, '-created_date', 1\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(checkout).toMatch(/checkout_request_key: requestKey[\s\S]*provider: 'stripe'[\s\S]*'-created_date',[\s\S]*2/);
    expect(checkout).toMatch(/Subscription\.filter\([\s\S]*\{ user_id: user\.id \},[\s\S]*'-created_date',[\s\S]*MAX_SUBSCRIPTION_HISTORY/);
    expect(checkout).toContain('const MAX_SUBSCRIPTION_HISTORY = 500;');
  });
});
