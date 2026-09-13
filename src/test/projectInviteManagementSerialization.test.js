// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('project invite management serialization', () => {
  it('serializes invite create/revoke with project membership mutations', async () => {
    for (const path of [
      'base44/functions/createProjectInvite/entry.ts',
      'base44/functions/revokeProjectInvites/entry.ts',
    ]) {
      const source = await readText(path);
      expect(source).toContain("req.method !== 'POST'");
      expect(source).toContain('acquireProjectMembershipLock');
      expect(source).toContain('releaseProjectMembershipLock');
      expect(source).toContain('status: 409');
      expect(source).toContain('isBase44EntityId(');
    }
  });
});
