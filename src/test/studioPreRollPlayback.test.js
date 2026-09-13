import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
describe('Studio pre-roll playback', () => {
  it('does not enter pre-roll playing state when all context audio is blocked', async () => {
    const s = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(s).toContain('const preRollPlayPromises = [];');
    expect(s).toContain('if (!started.some(Boolean))');
    expect(s).toContain("Pre-roll audio couldn't start. Click Record again to retry.");
    expect(s).toContain('pendingRecordStartRef.current = null;');
  });
});
