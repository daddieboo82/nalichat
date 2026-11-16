import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('PayPal checkout configuration guard', () => {
  it('rejects invalid or placeholder plan IDs before reserving checkout', async () => {
    const source = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    expect(source).toContain("PAYPAL_PLAN_CONFIGURATION_REQUIRED");
    expect(source).toContain("typeof planId !== 'string'");
    expect(source).toContain("!/^P-[A-Z0-9]{10,}$/.test(planId.trim())");
    expect(source.indexOf("PAYPAL_PLAN_CONFIGURATION_REQUIRED"))
      .toBeLessThan(source.indexOf("const reserved = await reservePayPalCheckout("));
  });

  it('rejects placeholder PayPal credentials before authorization', async () => {
    const source = await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');
    expect(source).toContain("id.startsWith('REPLACE_')");
    expect(source).toContain("secret.startsWith('REPLACE_')");
  });
});
