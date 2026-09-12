// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const endpoints = [
  ['base44/functions/mutateContact/entry.ts', 'Contact mutation failed'],
  ['base44/functions/createArtPost/entry.ts', 'Could not publish track'],
  ['base44/functions/mutateArtPost/entry.ts', 'ArtPost update failed'],
  ['base44/functions/deleteArtPost/entry.ts', 'Post deletion failed'],
  ['base44/functions/joinSquad/entry.ts', 'Could not join squad'],
  ['base44/functions/leaveSquad/entry.ts', 'Could not leave squad'],
  ['base44/functions/updateMyProfile/entry.ts', 'Profile update failed'],
  ['base44/functions/updateTypingStatus/entry.ts', 'Typing status update failed'],
  ['base44/functions/registerPushSubscription/entry.ts', 'Could not register push subscription'],
  ['base44/functions/unregisterPushSubscription/entry.ts', 'Could not unregister push subscription'],
];

describe('user CRUD error sanitization', () => {
  for (const [path, message] of endpoints) {
    it(`sanitizes ${path}`, async () => {
      const source = await readText(path);
      expect(source).toContain(`return Response.json({ error: '${message}' }, { status: 500 });`);
      expect(source).not.toContain('Response.json({ error: error?.message');
      expect(source).not.toContain('Response.json({ error: error.message');
    });
  }
});
