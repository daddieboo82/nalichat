import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

describe('Wix subscription checkout emergency safety stop', () => {
  it.each(['true', 'false', undefined])('blocks parallel Wix sessions independent of legacy flag (%s)', async (legacyFlag) => {
    const source = (await readFile('base44/functions/create-checkout/entry.ts', 'utf8'))
      .replace(/^import .*;\n/gm, '');
    const compiled = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
      reportDiagnostics: true,
    });
    expect((compiled.diagnostics || []).filter((d) => d.category === ts.DiagnosticCategory.Error)).toEqual([]);

    let handler;
    const counts = { entityRead: 0, entityWrite: 0, providerCall: 0, rateLimit: 0, secretRead: 0 };
    const entities = {
      Subscription: {
        filter: async () => { counts.entityRead++; return []; },
        create: async () => { counts.entityWrite++; return {}; },
      },
      Base44Purchase: {
        create: async () => { counts.entityWrite++; return {}; },
      },
    };
    const mockBase44 = {
      auth: { me: async () => ({ id: 'mock-customer', email: 'mock@example.invalid' }) },
      asServiceRole: { entities },
    };
    const sandbox = {
      createClientFromRequest: () => mockBase44,
      secrets: { get: () => { counts.secretRead++; return legacyFlag; } },
      APP_BASE_URL: 'https://nalichat.org',
      hasPaidTierAccess: () => false,
      normalizePlan: (v) => v,
      normalizeStatus: (v) => v,
      readJsonBodyLimited: async (req) => req.json(),
      requestBodyErrorResponse: () => null,
      consumeHourlyLimit: async () => {
        counts.rateLimit++;
        return { allowed: true };
      },
      Deno: { serve: (fn) => { handler = fn; } },
      fetch: async () => {
        counts.providerCall++;
        throw new Error('Unexpected Wix network call');
      },
      Response: { json: (body, options = {}) => ({ body, status: options.status || 200 }) },
      console: { error: () => {} },
      URL, Date,
    };
    runInNewContext(compiled.outputText, sandbox);
    expect(typeof handler).toBe('function');

    const [one, two] = await Promise.all([
      handler({ method: 'POST', json: async () => ({ sku: 'premium_monthly', idempotencyKey: 'ABCDEFGHIJKLMNOP' }) }),
      handler({ method: 'POST', json: async () => ({ sku: 'premium_monthly', idempotencyKey: 'QRSTUVWXYZabcdef' }) }),
    ]);
    expect([one.status, two.status]).toEqual([503, 503]);
    expect(one.body.error).toContain('temporarily unavailable');
    expect(two.body.error).toContain('temporarily unavailable');
    expect(counts).toEqual({ entityRead: 0, entityWrite: 0, providerCall: 0, rateLimit: 0, secretRead: 0 });

    const badKey = await handler({
      method: 'POST', json: async () => ({ sku: 'premium_monthly', idempotencyKey: 'short' }),
    });
    const wrongSku = await handler({
      method: 'POST', json: async () => ({ sku: 'bogus', idempotencyKey: 'ABCDEFGHIJKLMNOP' }),
    });
    expect(badKey.status).toBe(400);
    expect(wrongSku.status).toBe(400);
    expect((await handler({ method: 'GET' })).status).toBe(405);
  });
});
