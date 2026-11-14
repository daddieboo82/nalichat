import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const load = () => readFile('base44/functions/createPayPalSubscription/entry.ts', 'utf8');

describe('PayPal emergency checkout safety stop (#1048)', () => {
  it('fails closed before reading subscriptions or creating PayPal agreements', async () => {
    const code = await load();
    const functionStart = code.indexOf('function atomicCheckoutReservationIsImplemented(): boolean');
    const hardFalse = code.indexOf('return false;', functionStart);
    const gate = code.indexOf('if (!atomicCheckoutReservationIsImplemented())');
    const firstPlanSecretRead = code.indexOf('const planId = secrets.get(item.secret)');
    const firstSubscriptionRead = code.indexOf('const allSubs = await');
    const providerCreate = code.indexOf("fetch(apiBase() + '/v1/billing/subscriptions', {");
    expect(functionStart).toBeGreaterThanOrEqual(0);
    expect(hardFalse).toBeGreaterThan(functionStart);
    expect(hardFalse).toBeLessThan(gate);
    expect(gate).toBeLessThan(firstPlanSecretRead);
    expect(firstPlanSecretRead).toBeLessThan(firstSubscriptionRead);
    expect(firstSubscriptionRead).toBeLessThan(providerCreate);
    expect(code.slice(gate, firstSubscriptionRead)).toContain('status: 503');
    expect(code.slice(gate, firstSubscriptionRead)).toContain('temporarily unavailable');
  });

  it('cannot be enabled through the legacy operator secret', async () => {
    const code = await load();
    expect(code).not.toContain('PAYPAL_CHECKOUT_SERIALIZATION_VERIFIED');
    expect(code).toContain('function atomicCheckoutReservationIsImplemented(): boolean {\n  return false;\n}');
  });

  it('leaves existing subscription status and webhook code out of hotfix scope', async () => {
    const [pricing, subscriptionBilling] = await Promise.all([
      readFile('src/components/pricing/PricingPlans.jsx', 'utf8'),
      readFile('src/lib/subscriptionBilling.js', 'utf8'),
    ]);
    expect(pricing).toContain('toast.error(checkoutError?.message');
    expect(pricing).toContain('setStartingPlan(null)');
    expect(subscriptionBilling).toContain('startSubscriptionCheckout');
    expect(subscriptionBilling).toContain('payload?.error');
  });

  it.each(['true', 'false', undefined])('returns 503 before DB or PayPal side effects when the legacy flag is %s', async (legacyFlag) => {
    // Compile the *actual handler* with TypeScript to catch runtime mistakes
    // that source-string assertions cannot detect. No Base44 or PayPal network.
    const source = (await load()).replace(/^import .*;\n/gm, '');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.None,
      },
      reportDiagnostics: true,
    });
    const errors = compiled.diagnostics?.filter((d) => d.category === ts.DiagnosticCategory.Error) || [];
    expect(errors).toEqual([]);

    let handler;
    const operations = { subscriptionReads: 0, subscriptionWrites: 0, providerRequests: 0 };
    const Subscription = {
      filter: async () => { operations.subscriptionReads += 1; return []; },
      create: async () => { operations.subscriptionWrites += 1; return {}; },
      update: async () => { operations.subscriptionWrites += 1; return {}; },
    };
    const env = {
      PAYPAL_ENVIRONMENT: 'sandbox',
      PAYPAL_CLIENT_ID: 'mock-only',
      PAYPAL_CLIENT_SECRET: 'mock-only',
      PAYPAL_PREMIUM_MONTHLY_PLAN_ID: 'P-MOCK-PLAN',
      PAYPAL_CHECKOUT_SERIALIZATION_VERIFIED: legacyFlag,
    };
    const sandbox = {
      createClientFromRequest: () => ({
        auth: { me: async () => ({ id: 'mock-user' }) },
        asServiceRole: { entities: { Subscription } },
      }),
      secrets: { get: (key) => env[key] },
      APP_BASE_URL: 'https://nalichat.org',
      paypalPeriodEndForStatus: () => undefined,
      resolvePayPalSubscriptionStatus: async () => 'UNVERIFIED',
      hasPaidTierAccess: () => false,
      normalizePlan: (plan) => plan,
      normalizeStatus: (status) => status,
      Deno: { serve: (callback) => { handler = callback; } },
      fetch: async () => {
        operations.providerRequests += 1;
        throw new Error('Test must not call PayPal');
      },
      Response: { json: (body, options = {}) => ({ status: options.status || 200, body }) },
      console: { error: () => {} },
      Date, URL, encodeURIComponent,
      btoa: (value) => Buffer.from(value).toString('base64'),
    };
    runInNewContext(compiled.outputText, sandbox);
    expect(typeof handler).toBe('function');

    // Reproduce the former duplicate-billing race: two concurrent requests
    // for the same account and plan, but different idempotency keys.
    const [first, second] = await Promise.all([
      handler({
        method: 'POST',
        json: async () => ({ sku: 'premium_monthly', idempotencyKey: 'ABCDEFGHIJKLMNOP' }),
      }),
      handler({
        method: 'POST',
        json: async () => ({ sku: 'premium_monthly', idempotencyKey: 'QRSTUVWXYZabcdef' }),
      }),
    ]);
    expect(first.status).toBe(503);
    expect(second.status).toBe(503);

    // Input rejection must remain distinct from the temporary safety stop,
    // so unauthenticated or malformed calls never reach provider operations.
    const invalidKey = await handler({
      method: 'POST',
      json: async () => ({ sku: 'premium_monthly', idempotencyKey: 'short' }),
    });
    const unknownPlan = await handler({
      method: 'POST',
      json: async () => ({ sku: 'nonexistent_plan', idempotencyKey: 'ABCDEFGHIJKLMNOP' }),
    });
    const wrongMethod = await handler({ method: 'GET' });
    expect(invalidKey.status).toBe(400);
    expect(unknownPlan.status).toBe(400);
    expect(wrongMethod.status).toBe(405);
    expect(first.body.error).toContain('temporarily unavailable');
    expect(second.body.error).toContain('temporarily unavailable');
    expect(operations).toEqual({
      subscriptionReads: 0, subscriptionWrites: 0, providerRequests: 0,
    });
  });
});
