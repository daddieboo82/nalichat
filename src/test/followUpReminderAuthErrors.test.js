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


describe('follow-up reminder mutation response identity contract', () => {
  it('binds create, reschedule, and cancel confirmations to the current user and target', async () => {
    const client = await readFile('src/lib/followUpReminders.js', 'utf8');
    expect(client).toContain('data?.action !== "create_reminder"');
    expect(client).toContain('data?.action !== "reschedule_reminder"');
    expect(client).toContain('data?.action !== "cancel_reminder"');
    expect(client).toContain('data?.userId !== userId');
    expect(client).toContain('data?.reminder?.owner_id !== userId');
  });
});


describe('follow-up reminder list response identity contract', () => {
  it('binds reminder lists to the current authenticated owner', async () => {
    const backend = await readFile('base44/functions/listFollowUpReminders/entry.ts', 'utf8');
    const client = await readFile('src/lib/followUpReminders.js', 'utf8');
    expect(backend).toContain("action: 'list_reminders'");
    expect(backend).toContain('userId: user?.id || null');
    expect(client).toContain('data?.action !== "list_reminders"');
    expect(client).toContain('data?.userId !== userId');
    expect(client).toContain('reminder?.owner_id !== userId');
  });
});
