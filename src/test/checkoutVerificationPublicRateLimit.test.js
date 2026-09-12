import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public checkout verification abuse protection', () => {
  it('rate limits client lookups before purchase service-role reads', async () => {
    const source = await readFile('base44/functions/verifyCheckoutPayment/entry.ts', 'utf8');

    expect(source).toContain("'checkout_verification_lookup'");
    expect(source).toContain('checkout_verify_lookup_');
    expect(source).toContain('120');
    expect(source.indexOf('consumeHourlyLimit(')).toBeLessThan(
      source.indexOf('asServiceRole.entities.Base44Purchase.filter('),
    );
    expect(source).toContain("{ status: 429 }");
  });

  it('retains the post-verifier per-purchase throttle', async () => {
    const source = await readFile('base44/functions/verifyCheckoutPayment/entry.ts', 'utf8');

    expect(source).toContain("'checkout_verification'");
    expect(source).toContain('`purchase:${purchase.id}`');
  });
});
