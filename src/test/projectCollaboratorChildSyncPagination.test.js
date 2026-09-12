import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('project collaborator child access sync pagination', () => {
  it('pages through every project-backed child entity', async () => {
    const s=await readFile('base44/functions/manageProjectCollaborator/entry.ts','utf8');
    expect(s).toContain('const CHILD_SYNC_BATCH_SIZE = 200;');
    expect(s).toContain('for (let skip = 0; ; skip += CHILD_SYNC_BATCH_SIZE)');
    expect(s).toContain("'-created_date',");
    expect(s).toContain('CHILD_SYNC_BATCH_SIZE,');
    expect(s).toContain('skip,');
    expect(s).toContain('if (rows.length < CHILD_SYNC_BATCH_SIZE) break;');
  });
});
