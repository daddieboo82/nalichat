import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Admin PayPal recovery visibility', () => {
  it('shows existing provider and checkout-claim evidence without changing billing records', async () => {
    const ui = await readFile('src/components/admin/NaliMaintenancePanel.jsx', 'utf8');
    const backend = await readFile('base44/functions/getPendingPayPalAudit/entry.ts', 'utf8');
    for (const key of [
      'accountsWithUnmatchedCheckoutClaims', 'accountsWithMatchedCheckoutClaims',
      'pendingAccountsWithActiveRecord', 'oldestAttempt',
    ]) {
      expect(ui).toContain(key);
      expect(backend).toContain(key);
    }
    expect(ui).toContain('record.identityMatches === true && record.paymentRecorded === true');
    expect(ui).toContain('A missing payment field means unknown, not unpaid.');
    expect(ui).toContain('getPendingPayPalAudit');
  });
});
