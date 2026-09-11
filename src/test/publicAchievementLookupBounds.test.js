// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('public achievement lookup bounds', () => {
  it('is POST-only, validates ids, and rate-limits service-role reads', async () => {
    const source = await readText('base44/functions/listPublicAchievements/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('targetUserId.length > 256');
    expect(source).toContain('consumeHourlyLimit');
    expect(source).toContain("'public_achievement_lookup'");
    expect(source).toMatch(/'public_achievement_lookup',\s*240/);
    expect(source).toContain('Achievement lookup rate limit exceeded');
    expect(source.indexOf("'public_achievement_lookup'")).toBeLessThan(
      source.indexOf('entities.User.get(targetUserId)'),
    );
  });
});
