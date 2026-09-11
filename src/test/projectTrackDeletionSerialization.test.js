// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('project track deletion serialization', () => {
  it('locks each track before project cleanup deletes it', async () => {
    const source = await readText('base44/functions/deleteProject/entry.ts');

    expect(source).toContain('acquireTrackLifecycleLock');
    expect(source).toContain('releaseTrackLifecycleLock');
    expect(source).toContain('A track in this project is being updated. Please retry.');
    expect(source).toContain('currentTrack.project_id !== project.id');
    expect(source.indexOf('acquireTrackLifecycleLock')).toBeLessThan(
      source.indexOf('entities.Track.delete(track.id)'),
    );
  });
});
