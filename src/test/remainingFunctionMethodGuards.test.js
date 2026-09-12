// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const cases = [
  'base44/functions/generateNetworkProfiles/entry.ts',
  'base44/functions/getAiCapabilities/entry.ts',
  'base44/functions/listFollowUpReminders/entry.ts',
];

describe('remaining function method guards', () => {
  for (const path of cases) {
    it(`${path} rejects non-POST before auth/service-role work`, async () => {
      const source = await readFile(path, 'utf8');
      const method = source.indexOf("if (req.method !== 'POST')");
      const client = source.indexOf('createClientFromRequest(req)');
      expect(method).toBeGreaterThanOrEqual(0);
      expect(method).toBeLessThan(client);
      expect(source).toContain('status: 405');
    });
  }
});
