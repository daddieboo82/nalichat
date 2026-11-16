import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal recovery reporting', () => {
  it('aggregates multiple pending agreements without returning user identities in summary', async () => {
    const src = await readFile('base44/functions/getPendingPayPalAudit/entry.ts', 'utf8');
    expect(src).toContain('const pendingByAccount = new Map<string, number>()');
    expect(src).toContain('accountsWithMultiplePending');
    expect(src).toContain('largestPendingCountForAccount');
    expect(src).toContain('missingRequestKeys');
  });

  it('uses a separate read-only audit action requiring admin authentication', async () => {
    const src = await readFile('src/components/admin/NaliMaintenancePanel.jsx', 'utf8');
    expect(src).toContain('user?.role !== "admin"');
    expect(src).toContain('base44.functions.invoke("getPendingPayPalAudit", {})');
    expect(src).toContain('Audit PayPal (read-only)');
    expect(src).toContain('base44.functions.invoke("reconcilePendingPayPal", {})');
  });
});
