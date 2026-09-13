import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio track comment failures', () => {
  it('surfaces failed comment loads and comment creation errors', async () => {
    const s = await readFile('src/components/studio/TrackStrip.jsx', 'utf8');
    expect(s).toContain('isError: commentsError');
    expect(s).toContain("Couldn't load track comments.");
    expect(s).toContain('onClick={() => void refetchComments()}');
    expect(s).toContain("Couldn't add track comment. Please try again.");
  });
});
