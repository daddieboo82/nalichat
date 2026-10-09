import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('collaborative track lock scope', () => {
  it('validates trusted media URLs before acquiring the project membership lock', async () => {
    const s=await readFile('base44/functions/createCollaborativeTrack/entry.ts','utf8');
    const validate=s.indexOf('const fileUrl = body?.file_url ? cleanUploadedMediaUrl(body.file_url) :');
    const lock=s.indexOf('const projectLockId = initialProject');
    expect(validate).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(validate);
    expect(s).not.toContain('resolveStoredFileSize');
  });
  it('rechecks project edit authorization after lock acquisition', async () => {
    const s=await readFile('base44/functions/createCollaborativeTrack/entry.ts','utf8');
    const lock=s.indexOf('const projectLockId = initialProject');
    const recheck=s.indexOf('const canEdit = project.owner_id === user.id', lock);
    const create=s.indexOf('entities.Track.create', lock);
    expect(recheck).toBeGreaterThan(lock); expect(create).toBeGreaterThan(recheck);
  });
});
