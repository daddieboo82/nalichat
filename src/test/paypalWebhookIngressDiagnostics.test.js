import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal webhook ingress diagnostics', () => {
  it('logs receipt and malformed requests without exposing payload or payment identifiers', async () => {
    const source = await readFile('base44/functions/paypalWebhook/entry.ts', 'utf8');
    expect(source).toContain("console.info('PayPal webhook POST received')");
    expect(source).toContain("console.warn('PayPal webhook invalid JSON rejected')");
    expect(source).toContain("console.warn('PayPal webhook missing event envelope rejected')");
    expect(source.indexOf("console.info('PayPal webhook POST received')"))
      .toBeLessThan(source.indexOf('event = await req.json()'));
    expect(source).toContain("const verified = await verify(req, event, token)");
    expect(source).not.toContain('console.info(event)');
  });
});
