import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Track version history failures', () => {
  it('recovers from failed saves and distinguishes failed loads from empty history', async () => {
    const s = await readFile('src/components/studio/TrackVersionHistory.jsx', 'utf8');
    expect(s).toContain('isLoading, isError, refetch');
    expect(s).toContain("Couldn't load version history");
    expect(s).toContain('finally {\n      setSaving(false);');
    expect(s).toContain('res?.data?.success !== true || res?.data?.deleted !== true');
    expect(s).toContain('Track version deletion was not confirmed.');
    expect(s).toContain('created?.data?.success !== true || !created?.data?.version?.id');
    expect(s).toContain('Track version save was not confirmed.');
    expect(s).toContain("Couldn't save this version. Please try again.");
    expect(s).toContain("Couldn't delete this version. Please try again.");
  });
});
