import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal signature rejection diagnostics', () => {
  it('records a safe diagnostic when PayPal signature verification rejects a request', async () => {
    const source = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    expect(source).toContain("console.warn('PayPal webhook signature verification rejected')");
    expect(source).toContain("return Response.json({ error: 'Unauthorized' }, { status: 401 })");
    expect(source.indexOf("const verified = await verify(req, event, token)"))
      .toBeLessThan(source.indexOf('entities.PayPalWebhookEvent.filter('));
    expect(source).not.toContain('console.warn(event)');
    expect(source).not.toContain('console.warn(req.headers)');
  });
});
