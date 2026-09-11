// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('project deletion cascade bounds', () => {
  it('deletes project children in bounded batches', async () => {
    const source = await readText('base44/functions/deleteProject/entry.ts');

    expect(source).toMatch(/Track\.filter\([\s\S]*'-created_date',[\s\S]*100/);
    expect(source).toMatch(/TrackComment\.filter\([\s\S]*'-created_date',[\s\S]*200/);
    expect(source).toMatch(/entity\.filter\([\s\S]*project_id: project\.id[\s\S]*'-created_date',[\s\S]*200/);
    expect(source).toMatch(/StudioPresence\.filter\([\s\S]*'-last_heartbeat',[\s\S]*200/);
    expect(source).not.toContain('const tracks = await entities.Track.filter({ project_id: project.id });');
  });
});
