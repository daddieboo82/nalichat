// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('project folder creation serialization', () => {
  it('serializes project folder creation with project lifecycle mutations', async () => {
    const source = await readText('base44/functions/createProjectFolder/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('acquireProjectMembershipLock');
    expect(source).toContain('releaseProjectMembershipLock');
    expect(source).toContain('Folder name must be 200 characters or fewer');
    expect(source).toContain("project_id must be a string or null");
    expect(source).toContain('Project is being updated. Please retry.');
    expect(source).not.toContain('slice(0, 200)');
  });
});
