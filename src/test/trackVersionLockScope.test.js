import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('track version lifecycle lock scope', () => {
  it('verifies remote media before acquiring the track lifecycle lock', async () => {
    const s=await readFile('base44/functions/createTrackVersion/entry.ts','utf8');
    const verify=s.indexOf('const storedSize = await resolveStoredFileSize(verifiedVersionFileUrl)');
    const lock=s.indexOf('const lockId = await acquireTrackLifecycleLock(entities, trackId)');
    expect(verify).toBeGreaterThan(-1); expect(lock).toBeGreaterThan(verify);
  });
  it('rejects media changed after verification', async () => {
    const s=await readFile('base44/functions/createTrackVersion/entry.ts','utf8');
    expect(s).toContain('versionFileUrl !== verifiedVersionFileUrl');
    expect(s).toContain('Track media changed. Please retry saving the version.');
  });
});
