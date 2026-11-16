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
  it('offers a verified status refresh only when all reviewed PayPal agreements are terminal', async () => {
    const source = await readFile('src/components/settings/SubscriptionSettings.jsx', 'utf8');
    expect(source).toContain('pendingReview.results.length > 0');
    expect(source).toContain('pendingReview.results.every((result) => ["cancelled", "expired"].includes(result.status))');
    expect(source).toContain('onClick={refreshPendingStatus}');
    expect(source).toContain('const refresh = await refetch()');
    expect(source).toContain('refresh.isError || refresh.error || !refresh.data');
    expect(source).toContain('Earlier billing still needs review before checkout.');
    expect(source).toContain('Refresh subscription status');
    expect(source).toContain('if (refreshingPending || !user?.id || !subscription.hasPending) return');
    expect(source).not.toContain('createPayPalSubscription');
  });

});
