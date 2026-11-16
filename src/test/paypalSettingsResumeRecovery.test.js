import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal pending approval recovery in Settings', () => {
  it('offers recovery only for pending accounts without paid access', async () => {
    const source = await readFile('src/components/settings/SubscriptionSettings.jsx', 'utf8');
    expect(source).toContain('subscription.hasPending && !subscription.hasPaidAccess');
    expect(source).toContain('Continue existing PayPal approval');
    expect(source).toContain('resumePendingPayPalApproval({ expectedUserId: user.id })');
    expect(source).toContain('resumingApproval || !user?.id || subscription.hasPaidAccess || !subscription.hasPending');
    expect(source).toContain('mailto:nalichat@nalichat.org?subject=NaliChat%20PayPal%20billing%20review');
  });
});
