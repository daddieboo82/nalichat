// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { resolveUserSubscription } from '../../base44/shared/subscriptionAccess.ts';

describe('shared subscription access resolver', () => {
  it('keeps a permanent manual Premium Plus grant active without an expiration or external subscription', async () => {
    const manual = {
      id: 'manual-plus',
      user_id: 'user-1',
      plan: 'premium_plus',
      status: 'active',
      provider: 'manual',
      current_period_end: null,
      subscription_id: null,
    };
    const filter = vi.fn().mockResolvedValueOnce([manual]);

    const access = await resolveUserSubscription(
      { filter },
      'user-1',
      '2035-01-01T00:00:00.000Z',
    );

    expect(access.selected).toEqual(manual);
    expect(access.plan).toBe('premium_plus');
    expect(access.status).toBe('active');
    expect(access.currentPeriodEnd).toBeNull();
    expect(access.hasPaidAccess).toBe(true);
    expect(access.entitlements['ai.best_model']).toBe(true);
    expect(access.limits.ai.requestsPerUtcDay).toBe(1000);
  });

  it('loads bounded pages and selects the strongest paid subscription', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      id: `free-${index}`,
      plan: 'free',
      status: 'active',
    }));
    const paid = {
      id: 'paid',
      plan: 'premium_plus',
      status: 'active',
      current_period_end: '2026-10-01T00:00:00.000Z',
    };
    const filter = vi.fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([paid]);

    const access = await resolveUserSubscription(
      { filter },
      'user-1',
      '2026-09-11T00:00:00.000Z',
    );

    expect(filter).toHaveBeenNthCalledWith(1, { user_id: 'user-1' }, '-created_date', 500, 0);
    expect(filter).toHaveBeenNthCalledWith(2, { user_id: 'user-1' }, '-created_date', 500, 500);
    expect(access.selected).toEqual(paid);
    expect(access.plan).toBe('premium_plus');
    expect(access.hasPaidAccess).toBe(true);
    expect(access.entitlements['privacy.locked_chats']).toBe(true);
    expect(access.limits.ai.requestsPerUtcDay).toBe(1000);
  });
});
