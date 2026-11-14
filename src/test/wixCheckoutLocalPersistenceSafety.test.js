import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const wix = readFileSync('base44/functions/create-checkout/entry.ts', 'utf8');

describe('Wix checkout local persistence recovery safety', () => {
  it('never reports successful checkout after a failed local Subscription write', () => {
    const createIndex = wix.indexOf('await base44.asServiceRole.entities.Subscription.create(');
    const failureIndex = wix.indexOf('Failed to create Subscription record for Wix checkout:');
    const stopIndex = wix.indexOf("throw new Error('Checkout created but local subscription persistence failed; reconciliation required')");
    const successIndex = wix.indexOf("action: 'create_checkout'");
    expect(createIndex).toBeGreaterThan(-1);
    expect(failureIndex).toBeGreaterThan(createIndex);
    expect(stopIndex).toBeGreaterThan(failureIndex);
    expect(successIndex).toBeGreaterThan(stopIndex);
  });

  it('preserves the provider creation hard stop before any remote Wix session call', () => {
    const guard = wix.indexOf('if (!hasVerifiedAtomicWixReservation())');
    const provider = wix.indexOf('https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct');
    expect(wix).toContain('function hasVerifiedAtomicWixReservation(): boolean {\n  return false;');
    expect(guard).toBeGreaterThan(-1);
    expect(provider).toBeGreaterThan(guard);
  });
});
