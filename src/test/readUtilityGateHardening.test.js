import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('read utility gate hardening', () => {
  it('requires POST and blocks restricted liked-post lookups before service-role reads', async () => {
    const source = await readFile('base44/functions/listMyLikedPostIds/entry.ts', 'utf8');
    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain("if (user.is_banned)");
    expect(source).toContain("error: 'timed_out'");
    expect(source.indexOf("req.method !== 'POST'")).toBeLessThan(source.indexOf('auth.me()'));
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('consumeHourlyLimit('));
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('const posts = await listAllLikedPosts('));
  });

  it('blocks restricted AI capability lookups before subscription resolution', async () => {
    const source = await readFile('base44/functions/getAiCapabilities/entry.ts', 'utf8');
    expect(source).toContain("if (user.is_banned)");
    expect(source).toContain("error: 'timed_out'");
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('describeAiCapabilities({'));
  });

  it('blocks restricted read receipts before message service-role reads', async () => {
    const source = await readFile('base44/functions/markMessageRead/entry.ts', 'utf8');
    expect(source).toContain("if (user.is_banned)");
    expect(source).toContain("error: 'timed_out'");
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('consumeHourlyLimit('));
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('const message = await entities.Message.get'));
  });
});
