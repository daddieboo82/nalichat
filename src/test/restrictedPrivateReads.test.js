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

  it('keeps locked-chat account-security controls available while still requiring authentication and rate limits', async () => {
    const source = await readFile('base44/functions/lockedChatVault/entry.ts', 'utf8');
    expect(source).toContain("if (!user) return errorResponse('Unauthorized', 401, 'unauthorized')");
    expect(source).toContain('private account-security operations');
    expect(source).toContain("'locked_chat_state'");
    expect(source).toContain("'locked_chat_mutation'");
    expect(source).not.toContain('if (user.is_banned)');
  });
});
