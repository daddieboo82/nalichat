import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('restricted private read gates', () => {
  it('blocks restricted users before message search service-role work', async () => {
    const source = await readFile('base44/functions/searchMessages/entry.ts', 'utf8');
    expect(source).toContain("code: 'BANNED'");
    expect(source).toContain("code: 'TIMED_OUT'");
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('consumeHourlyLimit('));
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('executeMessageSearch({'));
  });

  it('blocks restricted users before locked-chat service-role reads', async () => {
    const source = await readFile('base44/functions/lockedChatVault/entry.ts', 'utf8');
    expect(source).toContain("return errorResponse('banned', 403, 'banned')");
    expect(source).toContain("code: 'timed_out'");
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('readJsonBodyLimited(req, 32 * 1024)'));
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('consumeHourlyLimit('));
  });
});
