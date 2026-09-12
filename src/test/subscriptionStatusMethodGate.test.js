import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('subscription status method gate', () => {
  it('rejects non-POST traffic before auth or service-role reads', async () => {
    const source = await readFile('base44/functions/checkSubscriptionStatus/entry.ts', 'utf8');
    expect(source).toContain("req.method !== 'POST'");
    expect(source.indexOf("req.method !== 'POST'")).toBeLessThan(source.indexOf('auth.me()'));
    expect(source.indexOf("req.method !== 'POST'")).toBeLessThan(source.indexOf('consumeHourlyLimit('));
  });
});
