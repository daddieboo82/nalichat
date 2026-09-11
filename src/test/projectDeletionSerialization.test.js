// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('project deletion serialization', () => {
  it('serializes destructive project cleanup with membership mutations', async () => {
    const source = await readText('base44/functions/deleteProject/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('acquireProjectMembershipLock');
    expect(source).toContain('releaseProjectMembershipLock');
    expect(source).toContain('status: 409');
    expect(source).toContain('projectId.length > 200');
    expect(source.indexOf('acquireProjectMembershipLock')).toBeLessThan(
      source.indexOf('entities.Project.get(projectId)'),
    );
  });
});
