// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('deterministic reward collision verification', () => {
  it('only treats create errors as duplicates when the deterministic record exists', async () => {
    const viral = await readText('base44/functions/generateViralConcepts/entry.ts');
    expect(viral).toContain('entities.Achievement.get(achievementId)');
    expect(viral).toContain('throw createError');

    const squad = await readText('base44/functions/recordSquadActivity/entry.ts');
    expect(squad).toContain("req.method !== 'POST'");
    expect(squad).toContain('entities.SquadReward.get(rewardId)');
    expect(squad).toContain('entities.SquadActivity.get(ledgerId)');
    expect(squad).toContain('throw createError');
  });
});
