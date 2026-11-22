import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('PayPal webhook status field', () => {
  it('does not interpret missing undocumented webhook status as disabled', async () => {
    const audit = await readFile('base44/functions/getPendingPayPalAudit/entry.ts','utf8');
    const setup = await readFile('base44/functions/setupPayPalWebhook/entry.ts','utf8');
    expect(audit).toContain("enabled: typeof match?.status === 'string' ? match.status === 'ENABLED' : null");
    expect(setup).toContain("const enabled = typeof remote.status === 'string' ? remote.status === 'ENABLED' : null");
    expect(setup).toContain('const verified = enabled !== false && urlMatches && missingEvents.length === 0');
    expect(setup).toContain('deliveryVerified: false');
  });
  it('keeps an unavailable status from triggering a disabled warning on the Business Dashboard', async () => {
    const dashboard = await readFile('src/pages/AdminDashboard.jsx', 'utf8');
    expect(dashboard).toContain('if (webhook.enabled === false)');
    expect(dashboard).toContain('"Unavailable from PayPal"');
    expect(dashboard).toContain('webhookIssues.length > 0');
  });
});