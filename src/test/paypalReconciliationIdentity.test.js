import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal pending reconciliation identity guards', () => {
  const files = [
    'base44/functions/reconcilePendingPayPal/entry.ts',
    'base44/functions/reconcilePendingPayPal/main.ts',
  ];
  for (const file of files) {
    it(`${file} verifies PayPal ownership before activation`, async () => {
      const source = await readFile(file, 'utf8');
      expect(source).toContain('remote?.id !== subscriptionId');
      expect(source).toContain('remote?.custom_id !== expectedCustomer');
      expect(source).toContain('remote?.plan_id !== subscription.paypal_plan_id');
      expect(source).toContain('subscription.paypal_environment !== expectedEnvironment');
      expect(source).toContain("result: 'identity_review_required'");
      expect(source.indexOf('remote?.custom_id !== expectedCustomer'))
        .toBeLessThan(source.indexOf('await resolvePayPalSubscriptionStatus('));
      expect(source).toContain("await validWorkflowKey(body?.workflow_key, WORKFLOW_KEY_SHA256)");
    });
  }
  it('requires deliberate admin confirmation before manually reconciling', async () => {
    const ui = await readFile('src/components/admin/NaliMaintenancePanel.jsx', 'utf8');
    expect(ui).toContain('user?.role !== "admin"');
    expect(ui).toContain('window.confirm(');
    expect(ui).toContain('base44.functions.invoke("reconcilePendingPayPal", {})');
  });
});
