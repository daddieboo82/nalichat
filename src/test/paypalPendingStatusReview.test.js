import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Customer pending PayPal status review', () => {
  it('checks pending agreement statuses without activation or billing mutations', async () => {
    const backend = await readFile('base44/functions/getMyPendingPayPalStatus/entry.ts','utf8');
    expect(backend).toContain("{ user_id: user.id, provider: 'paypal', status: 'pending' }");
    expect(backend).toContain("remote?.custom_id === user.id + ':' + row.sku");
    expect(backend).toContain("row.paypal_environment === env");
    expect(backend).toContain("status = state.toLowerCase()");
    expect(backend).not.toContain("'/activate'");
    expect(backend).not.toContain("Subscription.update(");
    expect(backend).not.toContain("Subscription.create(");
  });
  it('presents verified statuses without implying a charge', async () => {
    const frontend = await readFile('src/components/settings/SubscriptionSettings.jsx','utf8');
    expect(frontend).toContain('getMyPendingPayPalStatus');
    expect(frontend).toContain('Check existing PayPal agreements');
    expect(frontend).toContain('This check does not confirm payment or change billing.');
  });
});
