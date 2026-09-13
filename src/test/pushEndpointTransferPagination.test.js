import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('push endpoint ownership transfer', () => {
  it('paginates every matching endpoint row before transfer and cleanup', async () => {
    const s = await readFile('base44/functions/registerPushSubscription/entry.ts', 'utf8');
    expect(s).toContain('const endpointRows: any[] = []');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain("entity.filter({ endpoint }, '-created_date', pageSize, skip)");
    expect(s).toContain('endpointRows.push(...page)');
    expect(s).toContain('if (page.length < pageSize) break');
    expect(s).not.toContain("entity.filter({ endpoint }, '-created_date', 10)");
  });
});
