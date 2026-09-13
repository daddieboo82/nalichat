import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('view-only Studio saves', () => {
  it('rejects a shared-room save before uploading transient audio', async () => {
    const s = await readFile('src/pages/Studio.jsx', 'utf8');
    const saveStart = s.indexOf('const handleSave = async () => {');
    const guard = s.indexOf('if (roomId && !canEditProject)', saveStart);
    const blobUpload = s.indexOf('if (audioUrl.startsWith("blob:"))', saveStart);
    expect(guard).toBeGreaterThan(saveStart);
    expect(blobUpload).toBeGreaterThan(guard);
    expect(s).toContain('Your changes cannot be saved to the shared project.');
  });
});
