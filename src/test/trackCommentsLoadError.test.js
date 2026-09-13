import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('track comments load state', () => {
  it('does not show failed comment queries as an empty thread', async () => {
    const s = await readFile('src/components/explore/TrackCommentsDialog.jsx', 'utf8');
    expect(s).toContain('isLoading, isError, refetch');
    expect(s).toContain("Couldn't load comments");
    expect(s).toContain('onClick={() => void refetch()}');
  });
});
