// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('track version deletion serialization', () => {
  it('locks the parent track and re-reads the version before deletion', async () => {
    const source = await readText('base44/functions/deleteTrackVersion/entry.ts');

    expect(source).toContain('acquireTrackLifecycleLock');
    expect(source).toContain('releaseTrackLifecycleLock');
    expect(source).toContain('Track is being updated. Please retry.');
    expect(source).toContain('const currentVersion = await entities.TrackVersion.get(version.id)');
    expect(source).toContain('status: 409');
  });
});
