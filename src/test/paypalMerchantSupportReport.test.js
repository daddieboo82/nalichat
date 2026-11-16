import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Admin-only PayPal merchant investigation report', () => {
  it('captures provider request tracing without payment changes', async () => {
    const source = await readFile('base44/functions/getPendingPayPalAudit/entry.ts','utf8');
    expect(source).toContain("response.headers.get('paypal-debug-id')");
    expect(source).toContain('paypalDebugId: safeDebugId');
    expect(source).toContain("user.role !== 'admin'");
    expect(source).not.toContain("Subscription.update(");
    expect(source).not.toContain("Subscription.create(");
  });
  it('offers an explicitly copied admin support report', async () => {
    const source = await readFile('src/components/admin/NaliMaintenancePanel.jsx','utf8');
    expect(source).toContain('Copy PayPal merchant investigation report');
    expect(source).toContain('navigator.clipboard.writeText(paypalSupportReport)');
    expect(source).toContain('record.paypalDebugId');
    expect(source).toContain('Do not create or restart subscriptions based on this report alone.');
  });
});
