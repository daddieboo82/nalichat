// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const endpoints = [
  ['base44/functions/createChallenge/entry.ts', 'Could not create challenge'],
  ['base44/functions/createProjectFolder/entry.ts', 'Could not create folder'],
  ['base44/functions/createProjectMilestone/entry.ts', 'Could not create milestone'],
  ['base44/functions/createSharedFileRecord/entry.ts', 'Could not create shared file'],
  ['base44/functions/createTrackVersion/entry.ts', 'Could not save track version'],
  ['base44/functions/deleteChallenge/entry.ts', 'Could not delete challenge'],
  ['base44/functions/deleteChallengeSubmission/entry.ts', 'Could not delete submission'],
  ['base44/functions/deleteTrackVersion/entry.ts', 'Track version deletion failed'],
  ['base44/functions/manageProjectCollaborator/entry.ts', 'Could not update collaborator'],
  ['base44/functions/markMessageRead/entry.ts', 'Could not mark message read'],
  ['base44/functions/mutateMilestone/entry.ts', 'Milestone mutation failed'],
  ['base44/functions/submitChallengeRemix/entry.ts', 'Could not submit remix'],
  ['base44/functions/updateChallengeStatus/entry.ts', 'Challenge status update failed'],
];

describe('request body handler coverage', () => {
  for (const [path, message] of endpoints) {
    it(`classifies request body errors in ${path}`, async () => {
      const source = await readText(path);
      expect(source).toContain('requestBodyErrorResponse(error)');
      expect(source).toContain(`return Response.json({ error: '${message}' }, { status: 500 });`);
      expect(source).not.toContain('Response.json({ error: error?.message');
      expect(source).not.toContain('Response.json({ error: error.message');
    });
  }
});
