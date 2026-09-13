import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('billing portal subscription history pagination', () => {
  it('paginates all Stripe subscription rows before recovering a customer id', async () => {
    const s = await readFile('base44/functions/createBillingPortal/entry.ts', 'utf8');
    expect(s).toContain('async function loadStripeSubscriptions(entity: any, userId: string)');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain("{ user_id: userId, provider: 'stripe' }");
    expect(s).toContain('const subscriptions = await loadStripeSubscriptions(');
    expect(s).not.toContain("'-created_date',\n      100,");
  });
});
