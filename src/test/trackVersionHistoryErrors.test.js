import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Track version history failures', () => {
  it('recovers from failed saves and distinguishes failed loads from empty history', async () => {
    const s = await readFile('src/components/studio/TrackVersionHistory.jsx', 'utf8');
    expect(s).toContain('isLoading, isError, refetch');
    expect(s).toContain("Couldn't load version history");
    expect(s).toContain('finally {\n      setSaving(false);');
    expect(s).toContain('res?.data?.action !== "delete_track_version"');
    expect(s).toContain('res?.data?.userId !== currentUser?.id');
    expect(s).toContain('res?.data?.projectId !== track?.project_id');
    expect(s).toContain('res?.data?.trackId !== track?.id');
    expect(s).toContain('res?.data?.versionId !== id');
    expect(s).toContain('res?.data?.deleted !== true');
    expect(s).toContain('Track version deletion was not confirmed.');
    expect(s).toContain('created?.data?.action !== "create_track_version"');
    expect(s).toContain('created?.data?.userId !== currentUser?.id');
    expect(s).toContain('created?.data?.projectId !== track.project_id');
    expect(s).toContain('created?.data?.trackId !== track.id');
    expect(s).toContain('created?.data?.versionId !== version?.id');
    expect(s).toContain('Track version save was not confirmed.');
    expect(s).toContain("Couldn't save this version. Please try again.");
    expect(s).toContain("Couldn't delete this version. Please try again.");
  });
});
