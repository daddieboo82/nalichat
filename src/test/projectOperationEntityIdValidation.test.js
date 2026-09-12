import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const cases = [
  ['base44/functions/createProjectInvite/entry.ts', 'isBase44EntityId(projectId.trim())'],
  ['base44/functions/createProjectFolder/entry.ts', 'isBase44EntityId(projectId)'],
  ['base44/functions/createProjectMilestone/entry.ts', 'isBase44EntityId(body.project_id.trim())'],
  ['base44/functions/createCollaborativeTrack/entry.ts', 'isBase44EntityId(projectId)'],
  ['base44/functions/manageProjectCollaborator/entry.ts', 'isBase44EntityId(projectId.trim())'],
  ['base44/functions/manageProjectCollaborator/entry.ts', 'isBase44EntityId(userId.trim())'],
  ['base44/functions/revokeProjectInvites/entry.ts', 'isBase44EntityId(projectId)'],
  ['base44/functions/createSharedFileRecord/entry.ts', 'isBase44EntityId(projectId)'],
  ['base44/functions/createSharedFileRecord/entry.ts', 'isBase44EntityId(folderId)'],
];

describe('project operation entity id validation', () => {
  for (const [path, marker] of cases) {
    it(`${path} includes ${marker}`, async () => {
      const source = await readFile(path, 'utf8');
      expect(source).toContain(marker);
    });
  }
});
