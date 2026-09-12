import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('checkout verifier comparison', () => {
  it('uses a constant-time comparison for the public purchase verifier', async () => {
    const source = await readFile('base44/functions/verifyCheckoutPayment/entry.ts', 'utf8');
    expect(source).toContain('function constantTimeEqual(a: string, b: string): boolean');
    expect(source).toContain('constantTimeEqual(String(purchase.purchase_verifier_hash), verifierHash)');
    expect(source).not.toContain('purchase.purchase_verifier_hash !== verifierHash');
  });
});
