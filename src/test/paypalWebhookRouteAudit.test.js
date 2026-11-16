import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal webhook routing audit', () => {
  it('classifies registered routes without exposing or changing the callback address', async () => {
    const backend = await readFile('base44/functions/getPendingPayPalAudit/entry.ts','utf8');
    expect(backend).toContain("registeredRoute,");
    expect(backend).toContain("publicDomainMatch: webhookUrl === publicDomainUrl");
    expect(backend).toContain("webhookUrl === dispatcherUrl ? 'dispatcher'");
    expect(backend).toContain("webhookUrl === publicDomainUrl ? 'public_domain'");
    expect(backend).not.toContain('remote.url = publicDomainUrl');
  });
  it('warns admins about incomplete remote registration without claiming delivery success', async () => {
    const ui = await readFile('src/components/admin/NaliMaintenancePanel.jsx','utf8');
    expect(ui).toContain('paypalAudit.webhook?.registeredRoute');
    expect(ui).toContain('This classification does not confirm that PayPal can deliver events.');
    expect(ui).toContain('Webhook configuration needs review');
  });
});
