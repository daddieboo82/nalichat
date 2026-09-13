import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('shared file lock authorization ordering', () => {
  it('authorizes project/folder edit access before acquiring the project lock', async () => {
    const source = await readFile('base44/functions/createSharedFileRecord/entry.ts', 'utf8');
    const folderAuth = source.indexOf('let canEditFolder = user.role');
    const projectAuth = source.indexOf('const previewCanEdit = user.role');
    const lock = source.indexOf('await acquireProjectMembershipLock(entities, destinationProjectId)');
    expect(folderAuth).toBeGreaterThan(-1);
    expect(projectAuth).toBeGreaterThan(-1);
    expect(folderAuth).toBeLessThan(lock);
    expect(projectAuth).toBeLessThan(lock);
  });
});
