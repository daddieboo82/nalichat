// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const endpoints = [
  ['base44/functions/castVote/entry.ts', 'Vote failed'],
  ['base44/functions/claimPublishedPostReward/entry.ts', 'Could not award post XP'],
  ['base44/functions/createSquadInvite/entry.ts', 'Could not create squad invite'],
  ['base44/functions/getSquadBonusStatus/entry.ts', 'Could not load squad bonus status'],
  ['base44/functions/getSquadInvite/entry.ts', 'Could not load squad invite'],
  ['base44/functions/listMyLikedPostIds/entry.ts', 'Could not load likes'],
  ['base44/functions/listPublicAchievements/entry.ts', 'Could not load achievements'],
  ['base44/functions/recordArtPostPlay/entry.ts', 'Could not record play'],
  ['base44/functions/recordArtPostView/entry.ts', 'Could not record view'],
  ['base44/functions/recordSquadActivity/entry.ts', 'Could not record squad activity'],
  ['base44/functions/reportContent/entry.ts', 'Report failed'],
  ['base44/functions/toggleLike/entry.ts', 'Like update failed'],
];

describe('engagement error sanitization', () => {
  for (const [path, message] of endpoints) {
    it(`sanitizes ${path}`, async () => {
      const source = await readText(path);
      expect(source).toContain(`return Response.json({ error: '${message}' }, { status: 500 });`);
      expect(source).not.toContain('Response.json({ error: error?.message');
      expect(source).not.toContain('Response.json({ error: error.message');
    });
  }
});
