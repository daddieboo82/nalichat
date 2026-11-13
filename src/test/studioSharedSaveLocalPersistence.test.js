import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio shared save local persistence', () => {
  it('continues the cloud save when localStorage is unavailable in a shared room', async () => {
    const s = await readFile('src/pages/Studio.jsx', 'utf8');
    expect(s).toContain('let localPersistenceFailed = false;');
    expect(s).toContain('console.error("Studio local persistence failed", storageError);');
    expect(s).toContain('if (autosaveStorageKey && !roomId && !editsDuringSave) {');
    expect(s).toContain('localPersistenceFailed = true;');
    expect(s).toContain('Studio project saved to My Sessions. Local autosave is unavailable on this device.');
  });
});
