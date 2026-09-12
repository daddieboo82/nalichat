// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('remaining mutation method guards', () => {
  for (const path of [
    'base44/functions/leaveSquad/entry.ts',
    'base44/functions/setChatTheme/entry.ts',
    'base44/functions/manageCollaboration/entry.ts',
    'base44/functions/createFollowUpReminder/entry.ts',
    'base44/functions/cancelFollowUpReminder/entry.ts',
  ]) {
    it(`requires POST for ${path}`, async () => {
      const source = await readText(path);
      expect(source).toContain("if (req.method !== 'POST')");
      expect(source).toContain("Method not allowed");
    });
  }
});
