import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('shared-file folder parent validation', () => {
  it('validates the folder project before preview project lookup', async () => {
    const s=await readFile('base44/functions/createSharedFileRecord/entry.ts','utf8');
    const check=s.indexOf('folderProjectId && !isBase44EntityId(folderProjectId)');
    const read=s.indexOf('Project.get(folderProjectId)');
    expect(check).toBeGreaterThan(-1);
    expect(read).toBeGreaterThan(check);
  });
  it('rechecks the folder parent after project lock acquisition', async () => {
    const s=await readFile('base44/functions/createSharedFileRecord/entry.ts','utf8');
    const lock=s.indexOf('const projectLockId = destinationProjectId');
    const recheck=s.indexOf('folder.project_id && !isBase44EntityId(folder.project_id)', lock);
    expect(recheck).toBeGreaterThan(lock);
  });
});
