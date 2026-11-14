import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

// Execute the real draft handler against stubbed Base44/PayPal boundaries.
// This is an isolated contract test, NOT a production or sandbox integration test.
function transpileIsolatedHandler(source) {
  return source
    .replace(/^import .*;\n/gm, '')
    .replace(/^const CATALOG: Record<string, \{ plan: string; billingPeriod: string; secret: string \}>/m, 'const CATALOG')
    .replace(/: Promise<any\[\]>/g, '')
    .replace(/: any\[\]/g, '')
    .replace(/entity: any, userId: string/g, 'entity, userId')
    .replace(/\((sub|pending|link|x): any\)/g, '($1)')
    .replace(/let remotePrevious: any;/g, 'let remotePrevious;')
    .replace(/let (approvalUrl|newApprovalUrl): URL;/g, 'let $1;')
    .replace(/ as string/g, '')
    .replace(/function hasAtomicPayPalCheckoutReservation\(\): boolean/g, 'function hasAtomicPayPalCheckoutReservation()');
}

describe('PayPal recurring checkout hard-stop execution', () => {
  it.each([
    ['legacy true flag', 'true', 'premium_monthly', 'ABCDEFGHIJKLMNOP'],
    ['missing flag', undefined, 'premium_monthly', 'ABCDEFGHIJKLMNOP'],
    ['false flag', 'false', 'premium_monthly', 'ABCDEFGHIJKLMNOP'],
    ['different paid SKU', 'true', 'premium_plus_monthly', 'QRSTUVWXYZabcdef'],
    ['long valid request key', 'true', 'premium_monthly', 'x'.repeat(90)],
  ])('returns 503 without side effects: %s', async (_name, flag, sku, idempotencyKey) => {
    const code = transpileIsolatedHandler(
      await readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8'),
    );
    const calls = { reads: 0, writes: 0, paypal: 0 };
    let handler;
    const secrets = {
      get: (key) => ({
        PAYPAL_ENVIRONMENT: 'sandbox',
        PAYPAL_CLIENT_ID: 'not-real',
        PAYPAL_CLIENT_SECRET: 'not-real',
        PAYPAL_PREMIUM_MONTHLY_PLAN_ID: 'P-MOCK-MONTHLY',
        PAYPAL_PREMIUM_PLUS_MONTHLY_PLAN_ID: 'P-MOCK-PLUS',
        PAYPAL_CHECKOUT_SERIALIZATION_VERIFIED: flag,
      })[key],
    };
    const entity = {
      filter: async () => { calls.reads += 1; return []; },
      create: async () => { calls.writes += 1; return {}; },
      update: async () => { calls.writes += 1; return {}; },
    };
    const context = {
      createClientFromRequest: () => ({
        auth: { me: async () => ({ id: 'mock-user' }) },
        asServiceRole: { entities: { Subscription: entity } },
      }),
      secrets,
      APP_BASE_URL: 'https://nalichat.org',
      paypalPeriodEndForStatus: () => undefined,
      resolvePayPalSubscriptionStatus: async () => 'UNVERIFIED',
      hasPaidTierAccess: () => false,
      normalizePlan: (value) => value,
      normalizeStatus: (value) => value,
      Deno: { serve: (fn) => { handler = fn; } },
      fetch: async () => { calls.paypal += 1; throw new Error('Unexpected provider request'); },
      Response: { json: (body, options = {}) => ({ status: options.status || 200, body }) },
      console: { error: () => {} },
      URL,
      Date,
      encodeURIComponent,
      btoa: (value) => Buffer.from(value).toString('base64'),
    };
    runInNewContext(code, context);
    expect(typeof handler).toBe('function');
    const response = await handler({
      method: 'POST',
      json: async () => ({ sku, idempotencyKey }),
    });
    expect(response.status).toBe(503);
    expect(response.body.error).toContain('temporarily unavailable');
    expect(calls).toEqual({ reads: 0, writes: 0, paypal: 0 });
  });
});
