import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal webhook delivery diagnostics', () => {
  it('recognizes wildcard PayPal webhook subscriptions', async () => {
    const setup = await readFile('base44/functions/setupPayPalWebhook/entry.ts', 'utf8');
    expect(setup).toContain("!subscribed.has('*') && !subscribed.has(name)");
  });

  it('alerts the admin when the verified local ledger is empty without claiming a provider failure', async () => {
    const panel = await readFile('src/components/admin/NaliMaintenancePanel.jsx', 'utf8');
    expect(panel).toContain('paypalAudit.webhookLedgerCount === 0');
    expect(panel).toContain('This does not prove delivery failed.');
    expect(panel).toContain('check PayPal delivery history');
  });
});
