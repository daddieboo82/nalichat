import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('Files library pagination', () => {
  it('loads all accessible files, projects, and folders page by page', async () => {
    const s = await readFile('src/pages/Files.jsx', 'utf8');
    expect(s).toContain('async function listAllAccessible(entity, sort = "-created_date", pageSize = 200)');
    expect(s).toContain('for (let skip = 0; ; skip += pageSize)');
    expect(s).toContain('const page = await entity.list(sort, pageSize, skip)');
    expect(s).toContain('queryFn: () => listAllAccessible(base44.entities.SharedFile)');
    expect(s).toContain('const all = await listAllAccessible(base44.entities.Project)');
    expect(s).toContain('listAllAccessible(base44.entities.Folder)');
    expect(s).not.toContain('Project.list("-created_date", 500)');
  });
});
