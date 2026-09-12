import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const cases = [
  ['base44/functions/createProjectInvite/entry.ts', 'Only the project owner can create invite links'],
  ['base44/functions/revokeProjectInvites/entry.ts', 'Only the project owner can revoke invite links'],
  ['base44/functions/manageProjectCollaborator/entry.ts', 'Only the project owner can manage collaborator roles'],
  ['base44/functions/mutateProject/entry.ts', 'Viewer access cannot modify this project'],
  ['base44/functions/deleteProject/entry.ts', 'Only the project owner can delete this project'],
];

describe('project lock authorization ordering', () => {
  for (const [path, denial] of cases) {
    it(`authorizes ${path} before membership lock`, async () => {
      const source = await readFile(path, 'utf8');
      const preview = source.indexOf('projectPreview');
      const lock = source.indexOf('acquireProjectMembershipLock(');
      expect(preview).toBeGreaterThan(-1);
      expect(source).toContain(denial);
      expect(preview).toBeLessThan(lock);
    });
  }
});
