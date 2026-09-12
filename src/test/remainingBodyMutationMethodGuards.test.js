// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

function bodyReadIndex(source) {
  const bounded = source.indexOf('readJsonBodyLimited(req,');
  return bounded >= 0 ? bounded : source.indexOf('await req.json()');
}

const guardedPaths = [
  'base44/functions/joinSquad/entry.ts',
  'base44/functions/rescheduleFollowUpReminder/entry.ts',
  'base44/functions/mutateArtPost/entry.ts',
  'base44/functions/createCheckout/entry.ts',
];

describe('remaining body mutation method guards', () => {
  for (const path of guardedPaths) {
    it(`requires POST for ${path}`, async () => {
      const source = await readText(path);
      const methodGuard = source.indexOf("if (req.method !== 'POST')");
      const bodyRead = bodyReadIndex(source);

      expect(methodGuard).toBeGreaterThanOrEqual(0);
      expect(source).toContain("return Response.json({ error: 'Method not allowed' }, { status: 405 });");
      expect(bodyRead).toBeGreaterThanOrEqual(0);
      expect(methodGuard).toBeLessThan(bodyRead);
    });
  }
});
