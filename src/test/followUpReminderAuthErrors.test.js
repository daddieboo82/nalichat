// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('follow-up reminder auth error handling', () => {
  it('routes unauthenticated requests through the shared 401 path', async () => {
    const paths = [
      'base44/functions/createFollowUpReminder/entry.ts',
      'base44/functions/listFollowUpReminders/entry.ts',
      'base44/functions/cancelFollowUpReminder/entry.ts',
      'base44/functions/rescheduleFollowUpReminder/entry.ts',
    ];

    for (const path of paths) {
      const source = await readText(path);
      expect(source).toContain('base44.auth.me().catch(() => null)');
    }

    const shared = await readText('base44/shared/followUpReminders.ts');
    expect(shared).toContain("FollowUpReminderError(401, 'UNAUTHORIZED', 'Unauthorized.')");
  });
});
