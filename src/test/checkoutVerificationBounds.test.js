// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('checkout verification bounds', () => {
  it('rate-limits valid public verifier calls before Stripe reads', async () => {
    const source = await readText('base44/functions/verifyCheckoutPayment/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('consumeHourlyLimit');
    expect(source).toContain("'checkout_verification'");
    expect(source).toMatch(/'checkout_verification',\s*60/);
    expect(source).toContain('Checkout verification rate limit exceeded');
    expect(source.indexOf('purchase.purchase_verifier_hash')).toBeLessThan(
      source.indexOf("'checkout_verification'"),
    );
    expect(source.indexOf("'checkout_verification'")).toBeLessThan(
      source.indexOf('stripeRequest'),
    );
  });
});
