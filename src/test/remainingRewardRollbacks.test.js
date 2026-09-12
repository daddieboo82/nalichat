// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('remaining reward rollback reporting', () => {
  it('reports ArtPost play rollback failures', async () => {
    const source = await readText('base44/functions/recordArtPostPlay/entry.ts');
    expect(source).toContain('Play count update failed and play rollback was incomplete. Please retry.');
    expect(source).not.toContain('ArtPostPlay.delete(id).catch(() => {})');
  });

  it('reports ViralSeed achievement rollback failures', async () => {
    const source = await readText('base44/functions/generateViralConcepts/entry.ts');
    expect(source).toContain('ViralSeed XP update failed and achievement rollback was incomplete. Please retry.');
    expect(source).not.toContain('Achievement.delete(achievementId).catch(() => {})');
  });
});
