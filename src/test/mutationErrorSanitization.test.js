// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const endpoints = [
  ['base44/functions/mutateSharedFile/entry.ts', 'File mutation failed'],
  ['base44/functions/createProject/entry.ts', 'Could not create project'],
  ['base44/functions/manageConversation/entry.ts', 'Conversation action failed'],
];

describe('mutation endpoint error sanitization', () => {
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
