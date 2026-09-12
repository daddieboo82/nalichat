import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('shared file reference validation', () => {
  it('validates stored file project references before privileged reads', async () => {
    const s=await readFile('base44/functions/mutateSharedFile/entry.ts','utf8');
    expect(s.indexOf('isBase44EntityId(filePreview.project_id)')).toBeLessThan(s.indexOf('Project.get(filePreview.project_id)'));
  });
  it('rechecks the file project reference after file lock acquisition', async () => {
    const s=await readFile('base44/functions/mutateSharedFile/entry.ts','utf8');
    const lock=s.indexOf('const lockId = await acquireSharedFileMutationLock');
    expect(s.indexOf('File project changed. Please retry.',lock)).toBeGreaterThan(lock);
  });
  it('requires canonical folder ids and validates destination project references', async () => {
    const s=await readFile('base44/functions/mutateSharedFile/entry.ts','utf8');
    expect(s).toContain('isBase44EntityId(folderId)');
    expect(s).toContain('isBase44EntityId(folder.project_id)');
    expect(s).toContain('isBase44EntityId(currentFolder.project_id)');
  });
});
