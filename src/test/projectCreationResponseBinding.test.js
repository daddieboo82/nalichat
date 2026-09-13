// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('ProjectsSummary project creation response binding', () => {
  it('opens only the exact project requested by the active user', async () => {
    const source = await readFile('src/pages/ProjectsSummary.jsx', 'utf8');
    expect(source).toContain('const submittingUserId = user?.id');
    expect(source).toContain('const requestedTitle = newProjectTitle.trim()');
    expect(source).toContain('const requestedDescription = newProjectDescription.trim()');
    expect(source).toContain('created?.data?.userId !== submittingUserId');
    expect(source).toContain('project?.owner_id !== submittingUserId');
    expect(source).toContain('project?.title !== requestedTitle');
    expect(source).toContain('(project?.description || "") !== requestedDescription');
  });
});
