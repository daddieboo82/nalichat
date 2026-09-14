// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('exact-match lookup bounds', () => {
  it('keeps exact lookups bounded while checkout history is complete', async () => {
    const makeAdmin = await readText('base44/functions/makeAdmin/entry.ts');
    const external = await readText('base44/functions/sendExternalMessage/entry.ts');
    const checkout = await readText('base44/functions/createSubscriptionCheckout/entry.ts');

    expect(makeAdmin).toContain("const normalizedEmail = String(email || '').trim().toLowerCase();");
    expect(makeAdmin).toContain("User.filter({ email: normalizedEmail }, '-created_date', 2)");
    expect(makeAdmin).toContain("Multiple users match this email; manual reconciliation is required");
    expect(makeAdmin).toContain("User.get(target.id)");
    expect(external).toContain('{ email: normalizedDestination }');
    expect(external).toContain('{ email: cleanDestination }');
    expect(external.match(/'-created_date',\s*1/g)?.length).toBeGreaterThanOrEqual(2);
    expect(checkout.match(/User\.filter\(\{ id: user\.id \}, '-created_date', 1\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(checkout).toMatch(/checkout_request_key: requestKey[\s\S]*provider: 'stripe'[\s\S]*'-created_date',[\s\S]*2/);
    expect(checkout).toContain('async function loadUserSubscriptions(entity: any, userId: string)');
    expect(checkout).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(checkout).not.toContain('MAX_SUBSCRIPTION_HISTORY');
  });
});
