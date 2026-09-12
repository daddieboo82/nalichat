import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('moderation gate consistency', () => {
  it('blocks banned users from creating DMs', async () => {
    const source = await readFile('base44/functions/manageConversation/entry.ts', 'utf8');
    expect(source).toContain("['create_dm', 'create_group', 'create_public', 'join_public', 'rename']");
    expect(source).toContain("return Response.json({ error: 'banned' }, { status: 403 });");
  });

  it('blocks restricted users before presence writes', async () => {
    const source = await readFile('base44/functions/updateUserPresence/entry.ts', 'utf8');
    expect(source).toContain("if (user.is_banned)");
    expect(source).toContain("error: 'timed_out'");
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('consumeHourlyLimit('));
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('asServiceRole.entities.User.update'));
  });

  it('blocks restricted users before squad service-role reads', async () => {
    const source = await readFile('base44/functions/getSquadBonusStatus/entry.ts', 'utf8');
    expect(source).toContain("if (user.is_banned)");
    expect(source).toContain("error: 'timed_out'");
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('entities.Squad.filter'));
  });
});
