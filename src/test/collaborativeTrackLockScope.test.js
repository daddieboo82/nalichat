import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('collaborative track lock scope', () => {
  it('verifies remote media before acquiring the project membership lock', async () => {
    const s=await readFile('base44/functions/createCollaborativeTrack/entry.ts','utf8');
    const verify=s.indexOf('const storedSize = await resolveStoredFileSize(fileUrl)');
    const lock=s.indexOf('const projectLockId = initialProject');
    expect(verify).toBeGreaterThan(-1); expect(lock).toBeGreaterThan(verify);
  });
  it('rechecks project edit authorization after lock acquisition', async () => {
    const s=await readFile('base44/functions/createCollaborativeTrack/entry.ts','utf8');
    const lock=s.indexOf('const projectLockId = initialProject');
    const recheck=s.indexOf('const canEdit = project.owner_id === user.id', lock);
    const create=s.indexOf('entities.Track.create', lock);
    expect(recheck).toBeGreaterThan(lock); expect(create).toBeGreaterThan(recheck);
  });
});
