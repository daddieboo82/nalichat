import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('public achievement moderation gate', () => {
  it('blocks banned and timed-out callers before service-role reads', async () => {
    const source = await readFile('base44/functions/listPublicAchievements/entry.ts', 'utf8');
    expect(source).toContain("if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });");
    expect(source).toContain("return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });");
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('consumeHourlyLimit('));
    expect(source.indexOf('if (user.is_banned)')).toBeLessThan(source.indexOf('asServiceRole.entities.User.get'));
  });
});
