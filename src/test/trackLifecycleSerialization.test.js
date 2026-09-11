// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('track lifecycle serialization', () => {
  it('serializes track mutation/deletion with version creation', async () => {
    const helper = await readText('base44/shared/trackLifecycleLock.ts');
    expect(helper).toContain('TRACK_LIFECYCLE_LOCK_TTL_MS = 5 * 60 * 1000');
    expect(helper).toContain('TrackLifecycleLock.create');
    expect(helper).toContain('TrackLifecycleLock.delete');

    const mutate = await readText('base44/functions/mutateTrack/entry.ts');
    expect(mutate).toContain("req.method !== 'POST'");
    expect(mutate).toContain('acquireTrackLifecycleLock');
    expect(mutate).toContain('releaseTrackLifecycleLock');
    expect(mutate).toContain("Track name must be a string");
    expect(mutate).toContain('name.length > 200');
    expect(mutate).toContain("muted must be a boolean");
    expect(mutate).toContain('waveform_data supports at most 2000 points');
    expect(mutate).not.toContain('slice(0, 2000)');

    const version = await readText('base44/functions/createTrackVersion/entry.ts');
    expect(version).toContain('acquireTrackLifecycleLock');
    expect(version).toContain('releaseTrackLifecycleLock');
    expect(version).toContain('status: 409');
  });
});
