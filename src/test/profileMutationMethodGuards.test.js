// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

for (const path of [
  'base44/functions/updateMyProfile/entry.ts',
  'base44/functions/completeOnboarding/entry.ts',
]) {
  describe(path, () => {
    it('requires POST before profile state mutation work', async () => {
      const source = await readText(path);
      const methodGuard = source.indexOf("if (req.method !== 'POST')");
      const auth = source.indexOf('const base44 = createClientFromRequest(req)');
      const bodyRead = source.indexOf('await req.json()');

      expect(methodGuard).toBeGreaterThanOrEqual(0);
      expect(source).toContain("return Response.json({ error: 'Method not allowed' }, { status: 405 });");
      expect(methodGuard).toBeLessThan(auth);
      expect(methodGuard).toBeLessThan(bodyRead);
    });
  });
}
