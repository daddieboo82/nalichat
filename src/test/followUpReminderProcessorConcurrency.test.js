// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('follow-up reminder processor concurrency', () => {
  it('is POST-only and coalesces overlapping runs', async () => {
    const source = await readText('base44/functions/processDueFollowUpReminders/entry.ts');

    expect(source).toContain("req.method !== 'POST'");
    expect(source).toContain('let activeReminderRun: Promise<unknown> | null = null');
    expect(source).toContain('if (!activeReminderRun)');
    expect(source).toContain('if (activeReminderRun === run) activeReminderRun = null');
    expect(source).toContain('const summary = await activeReminderRun');
  });
});
