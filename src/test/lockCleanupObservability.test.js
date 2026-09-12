// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const lockFiles = [
  ['base44/shared/accountDeletionLock.ts', 'AccountDeletionLock', 'account deletion'],
  ['base44/shared/projectMembershipLock.ts', 'ProjectMembershipLock', 'project membership'],
  ['base44/shared/messageMutationLock.ts', 'MessageMutationLock', 'message mutation'],
];

describe('lock cleanup observability', () => {
  for (const [path, entity, label] of lockFiles) {
    it(`${path} does not swallow expired-lock deletion and logs release failures`, async () => {
      const source = await readText(path);
      expect(source).toContain(`await entities.${entity}.delete(id);`);
      expect(source).not.toContain(`entities.${entity}.delete(id).catch(() => {})`);
      expect(source).toContain(`Failed to release ${label} lock:`);
      expect(source).toContain('return false;');
    });
  }
});
