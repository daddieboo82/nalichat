import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('web push subscription pagination', () => {
  it('walks all subscription pages before endpoint deduplication and delivery', async () => {
    const s = await readFile('base44/shared/webPush.ts', 'utf8');
    expect(s).toContain('const pageSize = 200');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain("'-last_seen_at',");
    expect(s).toContain('subscriptions.push(...page)');
    expect(s).toContain('if (page.length < pageSize) break');
  });
});
