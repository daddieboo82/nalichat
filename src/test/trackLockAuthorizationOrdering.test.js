import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('track lifecycle lock authorization ordering', () => {
  it('authorizes track mutation before acquiring the lifecycle lock', async () => {
    const source = await readFile('base44/functions/mutateTrack/entry.ts', 'utf8');
    expect(source).toContain('trackPreview');
    expect(source).toContain('previewCanEdit');
    expect(source.indexOf('previewCanEdit')).toBeLessThan(source.indexOf('acquireTrackLifecycleLock(entities, trackId)'));
  });

  it('authorizes track-version deletion before acquiring the lifecycle lock', async () => {
    const source = await readFile('base44/functions/deleteTrackVersion/entry.ts', 'utf8');
    expect(source).toContain('projectPreview');
    expect(source).toContain('previewCanEdit');
    expect(source.indexOf('previewCanEdit')).toBeLessThan(source.indexOf('acquireTrackLifecycleLock(entities, version.track_id)'));
  });
});
