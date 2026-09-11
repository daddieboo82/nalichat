// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('dedupe lookup bounds', () => {
  it('limits vote and play duplicate verification to one record', async () => {
    const vote = await readText('base44/functions/castVote/entry.ts');
    const play = await readText('base44/functions/recordArtPostPlay/entry.ts');
    expect(vote).toMatch(/ChallengeVote\.filter\([\s\S]*'-created_date',[\s\S]*1/);
    expect(play).toMatch(/ArtPostPlay\.filter\([\s\S]*'-created_date',[\s\S]*1/);
  });

  it('limits squad invite and contact exact-match lookups', async () => {
    for (const path of [
      'base44/functions/joinSquad/entry.ts',
      'base44/functions/getSquadInvite/entry.ts',
      'base44/functions/createSquadInvite/entry.ts',
    ]) {
      const source = await readText(path);
      expect(source).toMatch(/Squad\.filter\([\s\S]*'-created_date',[\s\S]*1/);
    }

    const contact = await readText('base44/functions/mutateContact/entry.ts');
    expect(contact).toMatch(/Contact\.filter\([\s\S]*'-created_date',[\s\S]*1/);
  });
});
