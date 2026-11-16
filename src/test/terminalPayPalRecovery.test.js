import { describe, expect, it, vi } from 'vitest';
import { applyVerifiedTerminalPayPalRows } from '../../base44/shared/terminalPayPalRecovery.ts';

const record = (id) => ({
  id, subscription_id: 'I-' + id, paypal_plan_id: 'P-' + id,
  sku: 'premium_monthly',
});

describe('terminal PayPal conditional reconciliation', () => {
  it('updates only exact pending records and never invokes provider calls', async () => {
    const updateMany = vi.fn(async () => ({ updated: 1 }));
    const result = await applyVerifiedTerminalPayPalRows(
      { updateMany }, 'customer-a', 'live', [record('one'), record('two')],
    );
    expect(result).toEqual({ resolved: 2, complete: true });
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany).toHaveBeenCalledWith({
      id: 'one', user_id: 'customer-a', provider: 'paypal', status: 'pending',
      subscription_id: 'I-one', paypal_plan_id: 'P-one',
      sku: 'premium_monthly', paypal_environment: 'live',
    }, { $set: { status: 'canceled', cancel_at_period_end: false } });
  });

  it('does not overwrite a concurrently activated subscription', async () => {
    const updateMany = vi.fn(async () => ({ updated: 0 }));
    const result = await applyVerifiedTerminalPayPalRows(
      { updateMany }, 'customer-a', 'live', [record('one')],
    );
    expect(result).toEqual({ resolved: 0, complete: false });
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('stops after a conflicting update and accurately reports partial progress', async () => {
    const updateMany = vi.fn()
      .mockResolvedValueOnce({ updated: 1 })
      .mockResolvedValueOnce({ updated: 0 });
    const result = await applyVerifiedTerminalPayPalRows(
      { updateMany }, 'customer-a', 'live',
      [record('one'), record('two'), record('three')],
    );
    expect(result).toEqual({ resolved: 1, complete: false });
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it('treats a missing or ambiguous update count as failure', async () => {
    const updateMany = vi.fn(async () => ({}));
    const result = await applyVerifiedTerminalPayPalRows(
      { updateMany }, 'customer-a', 'live', [record('one')],
    );
    expect(result).toEqual({ resolved: 0, complete: false });
  });
});
