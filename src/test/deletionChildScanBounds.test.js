// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('deletion child scan bounds', () => {
  it('batches folder file detachment', async () => {
    const source = await readText('base44/functions/deleteFolder/entry.ts');
    expect(source).toMatch(/SharedFile\.filter\([\s\S]*'-created_date',[\s\S]*200/);
    expect(source).toContain('detachedFiles += 1');
  });

  it('batches challenge submission vote and comment cleanup', async () => {
    const source = await readText('base44/functions/deleteChallengeSubmission/entry.ts');
    expect(source).toMatch(/ChallengeVote\.filter\([\s\S]*'-created_date',[\s\S]*200/);
    expect(source).toMatch(/TrackComment\.filter\([\s\S]*'-created_date',[\s\S]*200/);
    expect(source).toContain('deletedVotes += 1');
    expect(source).toContain('deletedComments += 1');
  });
});
