import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('subscription checkout history pagination', () => {
  it('uses full subscription history for paid-access and trial eligibility checks', async () => {
    const s = await readFile('base44/functions/createSubscriptionCheckout/entry.ts', 'utf8');
    expect(s).toContain('async function loadUserSubscriptions(entity: any, userId: string)');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('loadUserSubscriptions(\n        base44.asServiceRole.entities.Subscription,\n        user.id,\n      )');
    expect(s).not.toContain('MAX_SUBSCRIPTION_HISTORY');
    expect(s).not.toContain("Subscription.filter(\n        { user_id: user.id },\n        '-created_date',\n        500,");
  });
});
