// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('scheduled admin function method enforcement', () => {
  for (const path of [
    'base44/functions/naliHealthCheck/entry.ts',
    'base44/functions/reengageStalledUsers/entry.ts',
  ]) {
    it(`${path} requires POST before scheduled/admin work`, async () => {
      const source = await readText(path);
      expect(source).toContain("if (req.method !== 'POST')");
      expect(source).toContain("Method not allowed");
      expect(source).toContain("status: 405");
    });
  }
});
