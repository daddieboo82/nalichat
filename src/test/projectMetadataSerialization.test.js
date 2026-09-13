// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('project metadata serialization', () => {
  it('serializes metadata writes with project lifecycle mutations and validates strings explicitly', async () => {
    const source = await readText('base44/functions/mutateProject/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('acquireProjectMembershipLock');
    expect(source).toContain('releaseProjectMembershipLock');
    expect(source).toContain('Project is being updated. Please retry.');
    expect(source).toContain('isBase44EntityId(projectId)');
    expect(source).toContain("Project title must be a string");
    expect(source).toContain('title.length > 200');
    expect(source).toContain('data.description.length > 3000');
    expect(source).toContain('genre.length > 100');
    expect(source).toContain('key.length > 50');
    expect(source).not.toContain('slice(0, 200)');
    expect(source).not.toContain('slice(0, 3000)');
  });
});
