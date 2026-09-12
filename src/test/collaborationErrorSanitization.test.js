// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const endpoints = [
  ['base44/functions/acceptProjectInvite/entry.ts', 'Could not accept project invite'],
  ['base44/functions/completeOnboarding/entry.ts', 'Could not complete onboarding'],
  ['base44/functions/createCollaborativeTrack/entry.ts', 'Could not create track'],
  ['base44/functions/createProjectInvite/entry.ts', 'Could not create project invite'],
  ['base44/functions/manageCollaboration/entry.ts', 'Collaboration update failed'],
  ['base44/functions/publishStudioBounce/entry.ts', 'Could not publish Studio bounce'],
  ['base44/functions/revokeProjectInvites/entry.ts', 'Could not revoke invite links'],
  ['base44/functions/updateStudioPresence/entry.ts', 'Studio presence update failed'],
];

describe('collaboration error sanitization', () => {
  for (const [path, message] of endpoints) {
    it(`sanitizes ${path}`, async () => {
      const source = await readText(path);
      expect(source).toContain(`return Response.json({ error: '${message}' }, { status: 500 });`);
      expect(source).not.toContain('Response.json({ error: error?.message');
      expect(source).not.toContain('Response.json({ error: error.message');
    });
  }
});
