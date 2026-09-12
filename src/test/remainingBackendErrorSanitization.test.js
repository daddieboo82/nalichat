import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const cases = [
  ['base44/functions/bounceAndMaster/entry.ts', "Unable to master audio"],
  ['base44/functions/seedGroupChatWelcome/entry.ts', "Unable to seed group chat welcome messages"],
  ['base44/functions/getAdminDashboardStats/entry.ts', "Unable to load admin dashboard stats"],
  ['base44/functions/checkSubscriptionStatus/entry.ts', "Unable to check subscription"],
];

describe('remaining backend error sanitization', () => {
  for (const [path, safeMessage] of cases) {
    it(`${path} returns a generic server error`, async () => {
      const source = await readFile(path, 'utf8');
      expect(source).toContain(safeMessage);
      expect(source).not.toContain('Response.json({ error: error.message }');
      expect(source).not.toContain("error instanceof Error ? error.message : 'Unable to check subscription'");
    });
  }

  it('call summary generation does not return raw provider exception text', async () => {
    const source = await readFile('base44/functions/callSummarySession/entry.ts', 'utf8');
    expect(source).toContain("return jsonError(502, errorCode(error), 'Summary generation failed.');");
    expect(source).not.toContain("return jsonError(502, errorCode(error), error instanceof Error ? error.message");
  });
});
