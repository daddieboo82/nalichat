import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal batch reconciliation resilience', () => {
  for (const file of [
    'base44/functions/reconcilePendingPayPal/entry.ts',
    'base44/functions/reconcilePendingPayPal/main.ts',
  ]) {
    it(`${file} isolates individual agreement failures`, async () => {
      const source = await readFile(file, 'utf8');
      expect(source).toContain("for (const subscription of pending) {");
      expect(source).toContain("result: 'agreement_check_failed'");
      expect(source).toContain("result: 'identity_review_required'");
      expect(source).toContain("remote?.custom_id !== expectedCustomer");
      expect(source).toContain("remote?.plan_id !== subscription.paypal_plan_id");
      expect(source).toContain("subscription.paypal_environment !== expectedEnvironment");
      expect(source.indexOf("result: 'agreement_check_failed'"))
        .toBeGreaterThan(source.indexOf("await base44.asServiceRole.entities.Subscription.update("));
    });
  }

  it('shows individually failed checks to the administrator', async () => {
    const ui = await readFile('src/components/admin/NaliMaintenancePanel.jsx', 'utf8');
    expect(ui).toContain('agreementFailures');
    expect(ui).toContain('agreement_check_failed');
  });
});
