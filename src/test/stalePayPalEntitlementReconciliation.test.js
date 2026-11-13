import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const source = () => readFile('base44/functions/checkSubscriptionStatus/entry.ts', 'utf8');

describe('stale active PayPal subscription reconciliation', () => {
  it('selects expired active PayPal records as well as pending records', async () => {
    const code = await source();
    expect(code).toContain("subscription.status === 'pending'");
    expect(code).toContain("subscription.status !== 'active'");
    expect(code).toContain("periodEndMs <= nowMs");
    expect(code).toContain("Number(right.status === 'active') - Number(left.status === 'active')");
  });

  it('requires a successful provider lookup before renewing local access', async () => {
    const code = await source();
    expect(code).toContain('if (!response.ok) continue;');
    expect(code).toContain('const status = paypalStatus(remoteStatus);');
    expect(code).toContain("status === 'active' && periodEnd === undefined");
    expect(code).toContain('update.current_period_end = null;');
    expect(code.indexOf('if (!response.ok) continue;')).toBeLessThan(code.indexOf('update.current_period_end = null;'));
    expect(code).toContain('await subscriptionEntity.update(subscription.id as string, update);');
  });

  it('keeps failed provider verification from granting paid access', async () => {
    const code = await source();
    expect(code).toContain('if (!token) return;');
    expect(code).toContain('if (!status) continue;');
    expect(code).toContain('console.error(\'PayPal status reconciliation failed\', error)');
    expect(code).toContain('hasPaidTierAccess(status, {');
  });
});
