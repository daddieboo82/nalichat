import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const endpoints = [
  ['base44/functions/onNewContent/entry.ts', 'Unable to process content notification'],
  ['base44/functions/generateNetworkProfiles/entry.ts', 'Unable to load network profile generator'],
];

describe('legacy endpoint error sanitization', () => {
  for (const [path, message] of endpoints) {
    it(`${path} does not expose raw exception messages`, async () => {
      const source = await readFile(path, 'utf8');
      expect(source).toContain(`return Response.json({ error: '${message}' }, { status: 500 });`);
      expect(source).not.toContain('Response.json({ error: error.message }');
      expect(source).not.toContain('Response.json({ error: error?.message');
    });
  }
});
