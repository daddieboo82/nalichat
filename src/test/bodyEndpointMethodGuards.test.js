// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

for (const path of [
  'base44/functions/get-studio-export-url/entry.ts',
  'base44/functions/getSquadInvite/entry.ts',
]) {
  describe(path, () => {
    it('requires POST before reading the request body', async () => {
      const source = await readText(path);
      const methodGuard = source.indexOf("if (req.method !== 'POST')");
      const bodyRead = source.indexOf('await req.json()');

      expect(methodGuard).toBeGreaterThanOrEqual(0);
      expect(source).toContain("return Response.json({ error: 'Method not allowed' }, { status: 405 });");
      expect(bodyRead).toBeGreaterThanOrEqual(0);
      expect(methodGuard).toBeLessThan(bodyRead);
    });
  });
}
