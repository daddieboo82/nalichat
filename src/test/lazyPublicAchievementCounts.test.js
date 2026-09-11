// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('lazy public achievement counts', () => {
  it('loads achievement counts only when explicitly requested', async () => {
    const backend = await readText('base44/functions/listPublicUsers/entry.ts');
    const leaderboard = await readText('src/pages/Leaderboard.jsx');
    const profile = await readText('src/pages/Profile.jsx');

    expect(backend).toContain('body?.includeAchievementCounts === true');
    expect(backend).toContain('includeAchievementCounts\n        ? base44.asServiceRole.entities.Achievement.list');
    expect(backend).toContain('includeAchievementCounts\n          ? base44.asServiceRole.entities.Achievement.filter');
    expect(leaderboard).toContain('includeAchievementCounts: true');
    expect(profile).not.toContain('includeAchievementCounts: true');
  });
});
