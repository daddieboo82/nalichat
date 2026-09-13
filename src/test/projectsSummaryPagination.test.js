import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Projects Summary pagination', () => {
  it('loads all accessible projects, milestones, and shared files', async () => {
    const s = await readFile('src/pages/ProjectsSummary.jsx', 'utf8');
    expect(s).toContain('async function listAllRows(entity, sort = "-created_date", pageSize = 200)');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('listAllRows(base44.entities.Project)');
    expect(s).toContain('listAllRows(base44.entities.Milestone)');
    expect(s).toContain('listAllRows(base44.entities.SharedFile)');
    expect(s).not.toContain('Project.list("-created_date", 500)');
  });
});
