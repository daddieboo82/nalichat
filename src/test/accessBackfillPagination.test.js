// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('access backfill pagination', () => {
  it('paginates every top-level backfill collection and track versions', async () => {
    const source = await readText('base44/functions/backfillTrackAccess/entry.ts');

    expect(source).toContain('const PAGE_SIZE = 200');
    for (const entity of ['Project', 'Track', 'SharedFile', 'Folder', 'Milestone']) {
      expect(source).toMatch(new RegExp(`entities\\.${entity}\\.filter\\(\\{\\}, '-created_date', PAGE_SIZE, skip\\)`));
    }
    expect(source).toMatch(/TrackVersion\.filter\([\s\S]*PAGE_SIZE,[\s\S]*versionSkip/);
    expect(source).not.toContain('entities.Project.filter({});');
    expect(source).not.toContain('entities.Track.filter({});');
    expect(source).not.toContain('entities.SharedFile.filter({});');
    expect(source).not.toContain('entities.Folder.filter({});');
    expect(source).not.toContain('entities.Milestone.filter({});');
  });
});
