import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Studio publish membership serialization', () => {
  it('rechecks project editor access after media verification and under the project lock', async () => {
    const s = await readFile('base44/functions/publishStudioBounce/entry.ts', 'utf8');
    const probe = s.indexOf('const storedSize = await resolveStoredFileSize(fileUrl)');
    const lock = s.indexOf('const projectLockId = projectId');
    const recheck = s.indexOf('const project = await entities.Project.get(projectId)', lock);
    const create = s.indexOf('const post = await entities.ArtPost.create({', recheck);

    expect(probe).toBeGreaterThan(-1);
    expect(lock).toBeGreaterThan(probe);
    expect(recheck).toBeGreaterThan(lock);
    expect(create).toBeGreaterThan(recheck);
    expect(s).toContain('releaseProjectMembershipLock(entities, projectLockId)');
  });
});
