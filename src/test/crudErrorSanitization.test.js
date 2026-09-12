// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const endpoints = [
  ['base44/functions/mutateTrack/entry.ts', 'Track mutation failed'],
  ['base44/functions/deleteFolder/entry.ts', 'Folder deletion failed'],
  ['base44/functions/deleteProject/entry.ts', 'Project deletion failed'],
  ['base44/functions/mutateProject/entry.ts', 'Project update failed'],
  ['base44/functions/mutatePlaylist/entry.ts', 'Playlist update failed'],
  ['base44/functions/createPlaylist/entry.ts', 'Could not create playlist'],
];

describe('CRUD endpoint error sanitization', () => {
  for (const [path, message] of endpoints) {
    it(`sanitizes ${path}`, async () => {
      const source = await readText(path);
      expect(source).toContain('requestBodyErrorResponse(error)');
      expect(source).toContain(`return Response.json({ error: '${message}' }, { status: 500 });`);
      expect(source).not.toContain('Response.json({ error: error?.message');
      expect(source).not.toContain('Response.json({ error: error.message');
    });
  }
});
